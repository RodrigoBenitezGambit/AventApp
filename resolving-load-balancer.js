"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
Object.defineProperty(exports, "__esModule", { value: true });
const load_balancer_1 = require("./load-balancer");
const channel_1 = require("./channel");
const resolver_1 = require("./resolver");
const picker_1 = require("./picker");
const backoff_timeout_1 = require("./backoff-timeout");
const constants_1 = require("./constants");
const metadata_1 = require("./metadata");
const logging = require("./logging");
const constants_2 = require("./constants");
const TRACER_NAME = 'resolving_load_balancer';
function trace(text) {
    logging.trace(constants_2.LogVerbosity.DEBUG, TRACER_NAME, text);
}
const DEFAULT_LOAD_BALANCER_NAME = 'pick_first';
class ResolvingLoadBalancer {
    /**
     * Wrapper class that behaves like a `LoadBalancer` and also handles name
     * resolution internally.
     * @param target The address of the backend to connect to.
     * @param channelControlHelper `ChannelControlHelper` instance provided by
     *     this load balancer's owner.
     * @param defaultServiceConfig The default service configuration to be used
     *     if none is provided by the name resolver. A `null` value indicates
     *     that the default behavior should be the default unconfigured behavior.
     *     In practice, that means using the "pick first" load balancer
     *     implmentation
     */
    constructor(target, channelControlHelper, defaultServiceConfig) {
        this.target = target;
        this.channelControlHelper = channelControlHelper;
        this.defaultServiceConfig = defaultServiceConfig;
        /**
         * Current internal load balancer used for handling calls.
         * Invariant: innerLoadBalancer === null => pendingReplacementLoadBalancer === null.
         */
        this.innerLoadBalancer = null;
        /**
         * The load balancer instance that will be used in place of the current
         * `innerLoadBalancer` once either that load balancer loses its connection
         * or this one establishes a connection. For use when a new name resolution
         * result comes in with a different load balancing configuration, and the
         * current `innerLoadBalancer` is still connected.
         */
        this.pendingReplacementLoadBalancer = null;
        /**
         * This resolving load balancer's current connectivity state.
         */
        this.currentState = channel_1.ConnectivityState.IDLE;
        /**
         * The service config object from the last successful resolution, if
         * available. A value of undefined indicates that there has not yet
         * been a successful resolution. A value of null indicates that the last
         * successful resolution explicitly provided a null service config.
         */
        this.previousServiceConfig = undefined;
        /**
         * The most recently reported connectivity state of the `innerLoadBalancer`.
         */
        this.innerBalancerState = channel_1.ConnectivityState.IDLE;
        this.innerBalancerPicker = new picker_1.UnavailablePicker();
        /**
         * The most recent reported state of the pendingReplacementLoadBalancer.
         * Starts at IDLE for type simplicity. This should get updated as soon as the
         * pendingReplacementLoadBalancer gets constructed.
         */
        this.replacementBalancerState = channel_1.ConnectivityState.IDLE;
        /**
         * The picker associated with the replacementBalancerState. Starts as an
         * UnavailablePicker for type simplicity. This should get updated as soon as
         * the pendingReplacementLoadBalancer gets constructed.
         */
        this.replacementBalancerPicker = new picker_1.UnavailablePicker();
        /**
         * Indicates whether we should attempt to resolve again after the backoff
         * timer runs out.
         */
        this.continueResolving = false;
        this.updateState(channel_1.ConnectivityState.IDLE, new picker_1.QueuePicker(this));
        this.innerResolver = resolver_1.createResolver(target, {
            onSuccessfulResolution: (addressList, serviceConfig, serviceConfigError) => {
                let workingServiceConfig = null;
                /* This first group of conditionals implements the algorithm described
                 * in https://github.com/grpc/proposal/blob/master/A21-service-config-error-handling.md
                 * in the section called "Behavior on receiving a new gRPC Config".
                 */
                if (serviceConfig === null) {
                    // Step 4 and 5
                    if (serviceConfigError === null) {
                        // Step 5
                        this.previousServiceConfig = serviceConfig;
                        workingServiceConfig = this.defaultServiceConfig;
                    }
                    else {
                        // Step 4
                        if (this.previousServiceConfig === undefined) {
                            // Step 4.ii
                            if (this.defaultServiceConfig === null) {
                                // Step 4.ii.b
                                this.handleResolutionFailure(serviceConfigError);
                            }
                            else {
                                // Step 4.ii.a
                                workingServiceConfig = this.defaultServiceConfig;
                            }
                        }
                        else {
                            // Step 4.i
                            workingServiceConfig = this.previousServiceConfig;
                        }
                    }
                }
                else {
                    // Step 3
                    workingServiceConfig = serviceConfig;
                    this.previousServiceConfig = serviceConfig;
                }
                let loadBalancerName = null;
                let loadBalancingConfig = null;
                if (workingServiceConfig === null ||
                    workingServiceConfig.loadBalancingConfig.length === 0) {
                    loadBalancerName = DEFAULT_LOAD_BALANCER_NAME;
                }
                else {
                    for (const lbConfig of workingServiceConfig.loadBalancingConfig) {
                        // Iterating through a oneof looking for whichever one is populated
                        for (const key in lbConfig) {
                            if (Object.prototype.hasOwnProperty.call(lbConfig, key)) {
                                if (load_balancer_1.isLoadBalancerNameRegistered(key)) {
                                    loadBalancerName = key;
                                    loadBalancingConfig = lbConfig;
                                    break;
                                }
                            }
                        }
                        if (loadBalancerName !== null) {
                            break;
                        }
                    }
                    if (loadBalancerName === null) {
                        // There were load balancing configs but none are supported. This counts as a resolution failure
                        this.handleResolutionFailure({
                            code: constants_1.Status.UNAVAILABLE,
                            details: 'All load balancer options in service config are not compatible',
                            metadata: new metadata_1.Metadata(),
                        });
                        return;
                    }
                }
                if (this.innerLoadBalancer === null) {
                    this.innerLoadBalancer = load_balancer_1.createLoadBalancer(loadBalancerName, this.innerChannelControlHelper);
                    this.innerLoadBalancer.updateAddressList(addressList, loadBalancingConfig);
                }
                else if (this.innerLoadBalancer.getTypeName() === loadBalancerName) {
                    this.innerLoadBalancer.updateAddressList(addressList, loadBalancingConfig);
                }
                else {
                    if (this.pendingReplacementLoadBalancer === null ||
                        this.pendingReplacementLoadBalancer.getTypeName() !==
                            loadBalancerName) {
                        if (this.pendingReplacementLoadBalancer !== null) {
                            this.pendingReplacementLoadBalancer.destroy();
                        }
                        this.pendingReplacementLoadBalancer = load_balancer_1.createLoadBalancer(loadBalancerName, this.replacementChannelControlHelper);
                    }
                    this.pendingReplacementLoadBalancer.updateAddressList(addressList, loadBalancingConfig);
                }
            },
            onError: (error) => {
                this.handleResolutionFailure(error);
            },
        });
        this.innerChannelControlHelper = {
            createSubchannel: (subchannelAddress, subchannelArgs) => {
                return this.channelControlHelper.createSubchannel(subchannelAddress, subchannelArgs);
            },
            updateState: (connectivityState, picker) => {
                this.innerBalancerState = connectivityState;
                if (connectivityState === channel_1.ConnectivityState.IDLE) {
                    picker = new picker_1.QueuePicker(this);
                }
                this.innerBalancerPicker = picker;
                if (connectivityState !== channel_1.ConnectivityState.READY &&
                    this.pendingReplacementLoadBalancer !== null) {
                    this.switchOverReplacementBalancer();
                }
                else {
                    if (connectivityState === channel_1.ConnectivityState.IDLE) {
                        if (this.innerLoadBalancer) {
                            this.innerLoadBalancer.destroy();
                            this.innerLoadBalancer = null;
                        }
                    }
                    this.updateState(connectivityState, picker);
                }
            },
            requestReresolution: () => {
                if (this.pendingReplacementLoadBalancer === null) {
                    /* If the backoffTimeout is running, we're still backing off from
                     * making resolve requests, so we shouldn't make another one here.
                     * In that case, the backoff timer callback will call
                     * updateResolution */
                    if (this.backoffTimeout.isRunning()) {
                        this.continueResolving = true;
                    }
                    else {
                        this.updateResolution();
                    }
                }
            },
        };
        this.replacementChannelControlHelper = {
            createSubchannel: (subchannelAddress, subchannelArgs) => {
                return this.channelControlHelper.createSubchannel(subchannelAddress, subchannelArgs);
            },
            updateState: (connectivityState, picker) => {
                if (connectivityState === channel_1.ConnectivityState.IDLE) {
                    picker = new picker_1.QueuePicker(this);
                }
                this.replacementBalancerState = connectivityState;
                this.replacementBalancerPicker = picker;
                if (connectivityState === channel_1.ConnectivityState.READY) {
                    this.switchOverReplacementBalancer();
                }
                else if (connectivityState === channel_1.ConnectivityState.IDLE) {
                    if (this.pendingReplacementLoadBalancer) {
                        this.pendingReplacementLoadBalancer.destroy();
                        this.pendingReplacementLoadBalancer = null;
                    }
                }
            },
            requestReresolution: () => {
                /* If the backoffTimeout is running, we're still backing off from
                 * making resolve requests, so we shouldn't make another one here.
                 * In that case, the backoff timer callback will call
                 * updateResolution */
                if (this.backoffTimeout.isRunning()) {
                    this.continueResolving = true;
                }
                else {
                    this.updateResolution();
                }
            },
        };
        this.backoffTimeout = new backoff_timeout_1.BackoffTimeout(() => {
            if (this.continueResolving) {
                this.updateResolution();
                this.continueResolving = false;
            }
            else {
                if (this.innerLoadBalancer === null) {
                    this.updateState(channel_1.ConnectivityState.IDLE, new picker_1.QueuePicker(this));
                }
                else {
                    this.updateState(this.innerBalancerState, this.innerBalancerPicker);
                }
            }
        });
    }
    updateResolution() {
        this.innerResolver.updateResolution();
        if (this.innerLoadBalancer === null ||
            this.innerBalancerState === channel_1.ConnectivityState.IDLE) {
            this.updateState(channel_1.ConnectivityState.CONNECTING, new picker_1.QueuePicker(this));
        }
    }
    updateState(connectivitystate, picker) {
        trace(this.target +
            ' ' +
            channel_1.ConnectivityState[this.currentState] +
            ' -> ' +
            channel_1.ConnectivityState[connectivitystate]);
        this.currentState = connectivitystate;
        this.channelControlHelper.updateState(connectivitystate, picker);
    }
    /**
     * Stop using the current innerLoadBalancer and replace it with the
     * pendingReplacementLoadBalancer. Must only be called if both of
     * those are currently not null.
     */
    switchOverReplacementBalancer() {
        this.innerLoadBalancer.destroy();
        this.innerLoadBalancer = this.pendingReplacementLoadBalancer;
        this.innerLoadBalancer.replaceChannelControlHelper(this.innerChannelControlHelper);
        this.pendingReplacementLoadBalancer = null;
        this.innerBalancerState = this.replacementBalancerState;
        this.innerBalancerPicker = this.replacementBalancerPicker;
        this.updateState(this.replacementBalancerState, this.replacementBalancerPicker);
    }
    handleResolutionFailure(error) {
        if (this.innerLoadBalancer === null ||
            this.innerBalancerState === channel_1.ConnectivityState.IDLE) {
            this.updateState(channel_1.ConnectivityState.TRANSIENT_FAILURE, new picker_1.UnavailablePicker(error));
        }
        this.backoffTimeout.runOnce();
    }
    exitIdle() {
        if (this.innerLoadBalancer !== null) {
            this.innerLoadBalancer.exitIdle();
        }
        if (this.currentState === channel_1.ConnectivityState.IDLE) {
            if (this.backoffTimeout.isRunning()) {
                this.continueResolving = true;
            }
            else {
                this.updateResolution();
            }
            this.updateState(channel_1.ConnectivityState.CONNECTING, new picker_1.QueuePicker(this));
        }
    }
    updateAddressList(addressList, lbConfig) {
        throw new Error('updateAddressList not supported on ResolvingLoadBalancer');
    }
    resetBackoff() {
        this.backoffTimeout.reset();
        if (this.innerLoadBalancer !== null) {
            this.innerLoadBalancer.resetBackoff();
        }
        if (this.pendingReplacementLoadBalancer !== null) {
            this.pendingReplacementLoadBalancer.resetBackoff();
        }
    }
    destroy() {
        if (this.innerLoadBalancer !== null) {
            this.innerLoadBalancer.destroy();
            this.innerLoadBalancer = null;
        }
        if (this.pendingReplacementLoadBalancer !== null) {
            this.pendingReplacementLoadBalancer.destroy();
            this.pendingReplacementLoadBalancer = null;
        }
        this.updateState(channel_1.ConnectivityState.SHUTDOWN, new picker_1.UnavailablePicker());
    }
    getTypeName() {
        return 'resolving_load_balancer';
    }
    replaceChannelControlHelper(channelControlHelper) {
        this.channelControlHelper = channelControlHelper;
    }
}
exports.ResolvingLoadBalancer = ResolvingLoadBalancer;
//# sourceMappingURL=resolving-load-balancer.js.map