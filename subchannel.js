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
const http2 = require("http2");
const tls_1 = require("tls");
const channel_1 = require("./channel");
const backoff_timeout_1 = require("./backoff-timeout");
const resolver_1 = require("./resolver");
const logging = require("./logging");
const constants_1 = require("./constants");
const { version: clientVersion } = require('../../package.json');
const TRACER_NAME = 'subchannel';
function trace(text) {
    logging.trace(constants_1.LogVerbosity.DEBUG, TRACER_NAME, text);
}
const MIN_CONNECT_TIMEOUT_MS = 20000;
const INITIAL_BACKOFF_MS = 1000;
const BACKOFF_MULTIPLIER = 1.6;
const MAX_BACKOFF_MS = 120000;
const BACKOFF_JITTER = 0.2;
/* setInterval and setTimeout only accept signed 32 bit integers. JS doesn't
 * have a constant for the max signed 32 bit integer, so this is a simple way
 * to calculate it */
const KEEPALIVE_MAX_TIME_MS = ~(1 << 31);
const KEEPALIVE_TIMEOUT_MS = 20000;
const { HTTP2_HEADER_AUTHORITY, HTTP2_HEADER_CONTENT_TYPE, HTTP2_HEADER_METHOD, HTTP2_HEADER_PATH, HTTP2_HEADER_TE, HTTP2_HEADER_USER_AGENT, } = http2.constants;
/**
 * Get a number uniformly at random in the range [min, max)
 * @param min
 * @param max
 */
function uniformRandom(min, max) {
    return Math.random() * (max - min) + min;
}
const tooManyPingsData = Buffer.from('too_many_pings', 'ascii');
class Subchannel {
    /**
     * A class representing a connection to a single backend.
     * @param channelTarget The target string for the channel as a whole
     * @param subchannelAddress The address for the backend that this subchannel
     *     will connect to
     * @param options The channel options, plus any specific subchannel options
     *     for this subchannel
     * @param credentials The channel credentials used to establish this
     *     connection
     */
    constructor(channelTarget, subchannelAddress, options, credentials) {
        this.channelTarget = channelTarget;
        this.subchannelAddress = subchannelAddress;
        this.options = options;
        this.credentials = credentials;
        /**
         * The subchannel's current connectivity state. Invariant: `session` === `null`
         * if and only if `connectivityState` is IDLE or TRANSIENT_FAILURE.
         */
        this.connectivityState = channel_1.ConnectivityState.IDLE;
        /**
         * The underlying http2 session used to make requests.
         */
        this.session = null;
        /**
         * Indicates that the subchannel should transition from TRANSIENT_FAILURE to
         * CONNECTING instead of IDLE when the backoff timeout ends.
         */
        this.continueConnecting = false;
        /**
         * A list of listener functions that will be called whenever the connectivity
         * state changes. Will be modified by `addConnectivityStateListener` and
         * `removeConnectivityStateListener`
         */
        this.stateListeners = [];
        /**
         * A list of listener functions that will be called when the underlying
         * socket disconnects. Used for ending active calls with an UNAVAILABLE
         * status.
         */
        this.disconnectListeners = [];
        /**
         * The amount of time in between sending pings
         */
        this.keepaliveTimeMs = KEEPALIVE_MAX_TIME_MS;
        /**
         * The amount of time to wait for an acknowledgement after sending a ping
         */
        this.keepaliveTimeoutMs = KEEPALIVE_TIMEOUT_MS;
        /**
         * Tracks calls with references to this subchannel
         */
        this.callRefcount = 0;
        /**
         * Tracks channels and subchannel pools with references to this subchannel
         */
        this.refcount = 0;
        // Build user-agent string.
        this.userAgent = [
            options['grpc.primary_user_agent'],
            `grpc-node-js/${clientVersion}`,
            options['grpc.secondary_user_agent'],
        ]
            .filter(e => e)
            .join(' '); // remove falsey values first
        if ('grpc.keepalive_time_ms' in options) {
            this.keepaliveTimeMs = options['grpc.keepalive_time_ms'];
        }
        if ('grpc.keepalive_timeout_ms' in options) {
            this.keepaliveTimeoutMs = options['grpc.keepalive_timeout_ms'];
        }
        this.keepaliveIntervalId = setTimeout(() => { }, 0);
        clearTimeout(this.keepaliveIntervalId);
        this.keepaliveTimeoutId = setTimeout(() => { }, 0);
        clearTimeout(this.keepaliveTimeoutId);
        this.backoffTimeout = new backoff_timeout_1.BackoffTimeout(() => {
            if (this.continueConnecting) {
                this.transitionToState([channel_1.ConnectivityState.TRANSIENT_FAILURE, channel_1.ConnectivityState.CONNECTING], channel_1.ConnectivityState.CONNECTING);
            }
            else {
                this.transitionToState([channel_1.ConnectivityState.TRANSIENT_FAILURE, channel_1.ConnectivityState.CONNECTING], channel_1.ConnectivityState.IDLE);
            }
        });
    }
    /**
     * Start a backoff timer with the current nextBackoff timeout
     */
    startBackoff() {
        this.backoffTimeout.runOnce();
    }
    stopBackoff() {
        this.backoffTimeout.stop();
        this.backoffTimeout.reset();
    }
    sendPing() {
        this.keepaliveTimeoutId = setTimeout(() => {
            this.transitionToState([channel_1.ConnectivityState.READY], channel_1.ConnectivityState.IDLE);
        }, this.keepaliveTimeoutMs);
        this.session.ping((err, duration, payload) => {
            clearTimeout(this.keepaliveTimeoutId);
        });
    }
    startKeepalivePings() {
        this.keepaliveIntervalId = setInterval(() => {
            this.sendPing();
        }, this.keepaliveTimeMs);
        this.sendPing();
    }
    stopKeepalivePings() {
        clearInterval(this.keepaliveIntervalId);
        clearTimeout(this.keepaliveTimeoutId);
    }
    startConnectingInternal() {
        const connectionOptions = this.credentials._getConnectionOptions() || {};
        let addressScheme = 'http://';
        if ('secureContext' in connectionOptions) {
            addressScheme = 'https://';
            // If provided, the value of grpc.ssl_target_name_override should be used
            // to override the target hostname when checking server identity.
            // This option is used for testing only.
            if (this.options['grpc.ssl_target_name_override']) {
                const sslTargetNameOverride = this.options['grpc.ssl_target_name_override'];
                connectionOptions.checkServerIdentity = (host, cert) => {
                    return tls_1.checkServerIdentity(sslTargetNameOverride, cert);
                };
                connectionOptions.servername = sslTargetNameOverride;
            }
            else {
                connectionOptions.servername = resolver_1.getDefaultAuthority(this.channelTarget);
            }
        }
        const session = http2.connect(addressScheme + this.subchannelAddress, connectionOptions);
        this.session = session;
        session.unref();
        /* For all of these events, check if the session at the time of the event
         * is the same one currently attached to this subchannel, to ensure that
         * old events from previous connection attempts cannot cause invalid state
         * transitions. */
        session.once('connect', () => {
            if (this.session === session) {
                this.transitionToState([channel_1.ConnectivityState.CONNECTING], channel_1.ConnectivityState.READY);
            }
        });
        session.once('close', () => {
            if (this.session === session) {
                this.transitionToState([channel_1.ConnectivityState.CONNECTING], channel_1.ConnectivityState.TRANSIENT_FAILURE);
                /* Transitioning directly to IDLE here should be OK because we are not
                 * doing any backoff, because a connection was established at some
                 * point */
                this.transitionToState([channel_1.ConnectivityState.READY], channel_1.ConnectivityState.IDLE);
            }
        });
        session.once('goaway', (errorCode, lastStreamID, opaqueData) => {
            if (this.session === session) {
                /* See the last paragraph of
                 * https://github.com/grpc/proposal/blob/master/A8-client-side-keepalive.md#basic-keepalive */
                if (errorCode === http2.constants.NGHTTP2_ENHANCE_YOUR_CALM &&
                    opaqueData.equals(tooManyPingsData)) {
                    logging.log(constants_1.LogVerbosity.ERROR, `Connection to ${this.channelTarget} rejected by server because of excess pings`);
                    this.keepaliveTimeMs = Math.min(2 * this.keepaliveTimeMs, KEEPALIVE_MAX_TIME_MS);
                }
                this.transitionToState([channel_1.ConnectivityState.CONNECTING, channel_1.ConnectivityState.READY], channel_1.ConnectivityState.IDLE);
            }
        });
        session.once('error', error => {
            /* Do nothing here. Any error should also trigger a close event, which is
             * where we want to handle that.  */
        });
    }
    /**
     * Initiate a state transition from any element of oldStates to the new
     * state. If the current connectivityState is not in oldStates, do nothing.
     * @param oldStates The set of states to transition from
     * @param newState The state to transition to
     * @returns True if the state changed, false otherwise
     */
    transitionToState(oldStates, newState) {
        if (oldStates.indexOf(this.connectivityState) === -1) {
            return false;
        }
        trace(this.subchannelAddress +
            ' ' +
            channel_1.ConnectivityState[this.connectivityState] +
            ' -> ' +
            channel_1.ConnectivityState[newState]);
        const previousState = this.connectivityState;
        this.connectivityState = newState;
        switch (newState) {
            case channel_1.ConnectivityState.READY:
                this.stopBackoff();
                this.session.socket.once('close', () => {
                    for (const listener of this.disconnectListeners) {
                        listener();
                    }
                });
                break;
            case channel_1.ConnectivityState.CONNECTING:
                this.startBackoff();
                this.startConnectingInternal();
                this.continueConnecting = false;
                break;
            case channel_1.ConnectivityState.TRANSIENT_FAILURE:
                if (this.session) {
                    this.session.close();
                }
                this.session = null;
                this.stopKeepalivePings();
                break;
            case channel_1.ConnectivityState.IDLE:
                /* Stopping the backoff timer here is probably redundant because we
                 * should only transition to the IDLE state as a result of the timer
                 * ending, but we still want to reset the backoff timeout. */
                this.stopBackoff();
                if (this.session) {
                    this.session.close();
                }
                this.session = null;
                this.stopKeepalivePings();
                break;
            default:
                throw new Error(`Invalid state: unknown ConnectivityState ${newState}`);
        }
        /* We use a shallow copy of the stateListeners array in case a listener
         * is removed during this iteration */
        for (const listener of [...this.stateListeners]) {
            listener(this, previousState, newState);
        }
        return true;
    }
    /**
     * Check if the subchannel associated with zero calls and with zero channels.
     * If so, shut it down.
     */
    checkBothRefcounts() {
        /* If no calls, channels, or subchannel pools have any more references to
         * this subchannel, we can be sure it will never be used again. */
        if (this.callRefcount === 0 && this.refcount === 0) {
            this.transitionToState([
                channel_1.ConnectivityState.CONNECTING,
                channel_1.ConnectivityState.IDLE,
                channel_1.ConnectivityState.READY,
            ], channel_1.ConnectivityState.TRANSIENT_FAILURE);
        }
    }
    callRef() {
        if (this.callRefcount === 0) {
            if (this.session) {
                this.session.ref();
            }
            this.startKeepalivePings();
        }
        this.callRefcount += 1;
    }
    callUnref() {
        this.callRefcount -= 1;
        if (this.callRefcount === 0) {
            if (this.session) {
                this.session.unref();
            }
            this.stopKeepalivePings();
            this.checkBothRefcounts();
        }
    }
    ref() {
        this.refcount += 1;
    }
    unref() {
        this.refcount -= 1;
        this.checkBothRefcounts();
    }
    unrefIfOneRef() {
        if (this.refcount === 1) {
            this.unref();
            return true;
        }
        return false;
    }
    /**
     * Start a stream on the current session with the given `metadata` as headers
     * and then attach it to the `callStream`. Must only be called if the
     * subchannel's current connectivity state is READY.
     * @param metadata
     * @param callStream
     */
    startCallStream(metadata, callStream) {
        const headers = metadata.toHttp2Headers();
        headers[HTTP2_HEADER_AUTHORITY] = callStream.getHost();
        headers[HTTP2_HEADER_USER_AGENT] = this.userAgent;
        headers[HTTP2_HEADER_CONTENT_TYPE] = 'application/grpc';
        headers[HTTP2_HEADER_METHOD] = 'POST';
        headers[HTTP2_HEADER_PATH] = callStream.getMethod();
        headers[HTTP2_HEADER_TE] = 'trailers';
        const http2Stream = this.session.request(headers);
        callStream.attachHttp2Stream(http2Stream, this);
    }
    /**
     * If the subchannel is currently IDLE, start connecting and switch to the
     * CONNECTING state. If the subchannel is current in TRANSIENT_FAILURE,
     * the next time it would transition to IDLE, start connecting again instead.
     * Otherwise, do nothing.
     */
    startConnecting() {
        /* First, try to transition from IDLE to connecting. If that doesn't happen
         * because the state is not currently IDLE, check if it is
         * TRANSIENT_FAILURE, and if so indicate that it should go back to
         * connecting after the backoff timer ends. Otherwise do nothing */
        if (!this.transitionToState([channel_1.ConnectivityState.IDLE], channel_1.ConnectivityState.CONNECTING)) {
            if (this.connectivityState === channel_1.ConnectivityState.TRANSIENT_FAILURE) {
                this.continueConnecting = true;
            }
        }
    }
    /**
     * Get the subchannel's current connectivity state.
     */
    getConnectivityState() {
        return this.connectivityState;
    }
    /**
     * Add a listener function to be called whenever the subchannel's
     * connectivity state changes.
     * @param listener
     */
    addConnectivityStateListener(listener) {
        this.stateListeners.push(listener);
    }
    /**
     * Remove a listener previously added with `addConnectivityStateListener`
     * @param listener A reference to a function previously passed to
     *     `addConnectivityStateListener`
     */
    removeConnectivityStateListener(listener) {
        const listenerIndex = this.stateListeners.indexOf(listener);
        if (listenerIndex > -1) {
            this.stateListeners.splice(listenerIndex, 1);
        }
    }
    addDisconnectListener(listener) {
        this.disconnectListeners.push(listener);
    }
    removeDisconnectListener(listener) {
        const listenerIndex = this.disconnectListeners.indexOf(listener);
        if (listenerIndex > -1) {
            this.disconnectListeners.splice(listenerIndex, 1);
        }
    }
    /**
     * Reset the backoff timeout, and immediately start connecting if in backoff.
     */
    resetBackoff() {
        this.backoffTimeout.reset();
        this.transitionToState([channel_1.ConnectivityState.TRANSIENT_FAILURE], channel_1.ConnectivityState.CONNECTING);
    }
    getAddress() {
        return this.subchannelAddress;
    }
}
exports.Subchannel = Subchannel;
//# sourceMappingURL=subchannel.js.map