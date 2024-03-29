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
const call_stream_1 = require("./call-stream");
const resolving_load_balancer_1 = require("./resolving-load-balancer");
const subchannel_pool_1 = require("./subchannel-pool");
const picker_1 = require("./picker");
const constants_1 = require("./constants");
const filter_stack_1 = require("./filter-stack");
const call_credentials_filter_1 = require("./call-credentials-filter");
const deadline_filter_1 = require("./deadline-filter");
const metadata_status_filter_1 = require("./metadata-status-filter");
const compression_filter_1 = require("./compression-filter");
const resolver_1 = require("./resolver");
const service_config_1 = require("./service-config");
const logging_1 = require("./logging");
var ConnectivityState;
(function (ConnectivityState) {
    ConnectivityState[ConnectivityState["CONNECTING"] = 0] = "CONNECTING";
    ConnectivityState[ConnectivityState["READY"] = 1] = "READY";
    ConnectivityState[ConnectivityState["TRANSIENT_FAILURE"] = 2] = "TRANSIENT_FAILURE";
    ConnectivityState[ConnectivityState["IDLE"] = 3] = "IDLE";
    ConnectivityState[ConnectivityState["SHUTDOWN"] = 4] = "SHUTDOWN";
})(ConnectivityState = exports.ConnectivityState || (exports.ConnectivityState = {}));
class ChannelImplementation {
    constructor(target, credentials, options) {
        this.target = target;
        this.credentials = credentials;
        this.options = options;
        this.connectivityState = ConnectivityState.IDLE;
        this.currentPicker = new picker_1.UnavailablePicker();
        this.pickQueue = [];
        this.connectivityStateWatchers = [];
        // TODO(murgatroid99): check channel arg for getting a private pool
        this.subchannelPool = subchannel_pool_1.getSubchannelPool(true);
        const channelControlHelper = {
            createSubchannel: (subchannelAddress, subchannelArgs) => {
                return this.subchannelPool.getOrCreateSubchannel(this.target, subchannelAddress, Object.assign({}, this.options, subchannelArgs), this.credentials);
            },
            updateState: (connectivityState, picker) => {
                this.currentPicker = picker;
                const queueCopy = this.pickQueue.slice();
                this.pickQueue = [];
                for (const { callStream, callMetadata } of queueCopy) {
                    this.tryPick(callStream, callMetadata);
                }
                this.updateState(connectivityState);
            },
            requestReresolution: () => {
                // This should never be called.
                throw new Error('Resolving load balancer should never call requestReresolution');
            },
        };
        // TODO(murgatroid99): check channel arg for default service config
        let defaultServiceConfig = {
            loadBalancingConfig: [],
            methodConfig: [],
        };
        if (options['grpc.service_config']) {
            defaultServiceConfig = service_config_1.validateServiceConfig(JSON.parse(options['grpc.service_config']));
        }
        this.resolvingLoadBalancer = new resolving_load_balancer_1.ResolvingLoadBalancer(target, channelControlHelper, defaultServiceConfig);
        this.filterStackFactory = new filter_stack_1.FilterStackFactory([
            new call_credentials_filter_1.CallCredentialsFilterFactory(this),
            new deadline_filter_1.DeadlineFilterFactory(this),
            new metadata_status_filter_1.MetadataStatusFilterFactory(this),
            new compression_filter_1.CompressionFilterFactory(this),
        ]);
        // TODO(murgatroid99): Add more centralized handling of channel options
        if (this.options['grpc.default_authority']) {
            this.defaultAuthority = this.options['grpc.default_authority'];
        }
        else {
            this.defaultAuthority = resolver_1.getDefaultAuthority(target);
        }
    }
    /**
     * Check the picker output for the given call and corresponding metadata,
     * and take any relevant actions. Should not be called while iterating
     * over pickQueue.
     * @param callStream
     * @param callMetadata
     */
    tryPick(callStream, callMetadata) {
        const pickResult = this.currentPicker.pick({ metadata: callMetadata });
        switch (pickResult.pickResultType) {
            case picker_1.PickResultType.COMPLETE:
                if (pickResult.subchannel === null) {
                    callStream.cancelWithStatus(constants_1.Status.UNAVAILABLE, 'Request dropped by load balancing policy');
                    // End the call with an error
                }
                else {
                    /* If the subchannel disconnects between calling pick and getting
                     * the filter stack metadata, the call will end with an error. */
                    callStream.filterStack
                        .sendMetadata(Promise.resolve(callMetadata))
                        .then(finalMetadata => {
                        if (pickResult.subchannel.getConnectivityState() ===
                            ConnectivityState.READY) {
                            try {
                                pickResult.subchannel.startCallStream(finalMetadata, callStream);
                            }
                            catch (error) {
                                callStream.cancelWithStatus(constants_1.Status.UNAVAILABLE, 'Failed to start call on picked subchannel');
                            }
                        }
                        else {
                            callStream.cancelWithStatus(constants_1.Status.UNAVAILABLE, 'Connection dropped while starting call');
                        }
                    }, (error) => {
                        // We assume the error code isn't 0 (Status.OK)
                        callStream.cancelWithStatus(error.code || constants_1.Status.UNKNOWN, `Getting metadata from plugin failed with error: ${error.message}`);
                    });
                }
                break;
            case picker_1.PickResultType.QUEUE:
                this.pickQueue.push({ callStream, callMetadata });
                break;
            case picker_1.PickResultType.TRANSIENT_FAILURE:
                if (callMetadata.getOptions().waitForReady) {
                    this.pickQueue.push({ callStream, callMetadata });
                }
                else {
                    callStream.cancelWithStatus(pickResult.status.code, pickResult.status.details);
                }
                break;
            default:
                throw new Error(`Invalid state: unknown pickResultType ${pickResult.pickResultType}`);
        }
    }
    removeConnectivityStateWatcher(watcherObject) {
        const watcherIndex = this.connectivityStateWatchers.findIndex(value => value === watcherObject);
        if (watcherIndex >= 0) {
            this.connectivityStateWatchers.splice(watcherIndex, 1);
        }
    }
    updateState(newState) {
        logging_1.trace(constants_1.LogVerbosity.DEBUG, 'connectivity_state', this.target +
            ' ' +
            ConnectivityState[this.connectivityState] +
            ' -> ' +
            ConnectivityState[newState]);
        this.connectivityState = newState;
        const watchersCopy = this.connectivityStateWatchers.slice();
        for (const watcherObject of watchersCopy) {
            if (newState !== watcherObject.currentState) {
                watcherObject.callback();
                clearTimeout(watcherObject.timer);
                this.removeConnectivityStateWatcher(watcherObject);
            }
        }
    }
    _startCallStream(stream, metadata) {
        this.tryPick(stream, metadata.clone());
    }
    close() {
        this.resolvingLoadBalancer.destroy();
        this.updateState(ConnectivityState.SHUTDOWN);
        this.subchannelPool.unrefUnusedSubchannels();
    }
    getTarget() {
        return this.target;
    }
    getConnectivityState(tryToConnect) {
        const connectivityState = this.connectivityState;
        if (tryToConnect) {
            this.resolvingLoadBalancer.exitIdle();
        }
        return connectivityState;
    }
    watchConnectivityState(currentState, deadline, callback) {
        const deadlineDate = deadline instanceof Date ? deadline : new Date(deadline);
        const now = new Date();
        if (deadlineDate <= now) {
            process.nextTick(callback, new Error('Deadline passed without connectivity state change'));
            return;
        }
        const watcherObject = {
            currentState,
            callback,
            timer: setTimeout(() => {
                this.removeConnectivityStateWatcher(watcherObject);
                callback(new Error('Deadline passed without connectivity state change'));
            }, deadlineDate.getTime() - now.getTime()),
        };
        this.connectivityStateWatchers.push(watcherObject);
    }
    createCall(method, deadline, host, parentCall, propagateFlags) {
        if (this.connectivityState === ConnectivityState.SHUTDOWN) {
            throw new Error('Channel has been shut down');
        }
        const finalOptions = {
            deadline: deadline === null || deadline === undefined ? Infinity : deadline,
            flags: propagateFlags || 0,
            host: host || this.defaultAuthority,
            parentCall: parentCall || null,
        };
        const stream = new call_stream_1.Http2CallStream(method, this, finalOptions, this.filterStackFactory, this.credentials._getCallCredentials());
        return stream;
    }
}
exports.ChannelImplementation = ChannelImplementation;
//# sourceMappingURL=channel.js.map