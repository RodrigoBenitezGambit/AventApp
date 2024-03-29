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
 */
Object.defineProperty(exports, "__esModule", { value: true });
const resolver_1 = require("./resolver");
const dns = require("dns");
const semver = require("semver");
const util = require("util");
const service_config_1 = require("./service-config");
const constants_1 = require("./constants");
const metadata_1 = require("./metadata");
const logging = require("./logging");
const constants_2 = require("./constants");
const TRACER_NAME = 'dns_resolver';
function trace(text) {
    logging.trace(constants_2.LogVerbosity.DEBUG, TRACER_NAME, text);
}
/* These regular expressions match IP addresses with optional ports in different
 * formats. In each case, capture group 1 contains the address, and capture
 * group 2 contains the port number, if present */
/**
 * Matches 4 groups of up to 3 digits each, separated by periods, optionally
 * followed by a colon and a number.
 */
const IPV4_REGEX = /^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d+))?$/;
/**
 * Matches any number of groups of up to 4 hex digits (case insensitive)
 * separated by 1 or more colons. This variant does not match a port number.
 */
const IPV6_REGEX = /^([0-9a-f]{0,4}(?::{1,2}[0-9a-f]{0,4})+)$/i;
/**
 * Matches the same as the IPv6_REGEX, surrounded by square brackets, and
 * optionally followed by a colon and a number.
 */
const IPV6_BRACKET_REGEX = /^\[([0-9a-f]{0,4}(?::{1,2}[0-9a-f]{0,4})+)\](?::(\d+))?$/i;
/**
 * Matches `[dns:][//authority/]host[:port]`, where `authority` and `host` are
 * both arbitrary sequences of dot-separated strings of alphanumeric characters
 * and `port` is a sequence of digits. Group 1 contains the hostname and group
 * 2 contains the port number if provided.
 */
const DNS_REGEX = /^(?:dns:)?(?:\/\/(?:[a-zA-Z0-9-]+\.?)+\/)?((?:[a-zA-Z0-9-]+\.?)+)(?::(\d+))?$/;
/**
 * The default TCP port to connect to if not explicitly specified in the target.
 */
const DEFAULT_PORT = '443';
/**
 * The range of Node versions in which the Node issue
 * https://github.com/nodejs/node/issues/28216 has been fixed. In other
 * versions, IPv6 literal addresses cannot be used to establish HTTP/2
 * connections.
 */
const IPV6_SUPPORT_RANGE = '>= 12.6';
/**
 * Get a promise that always resolves with either the result of the function
 * or the error if it failed.
 * @param fn
 */
function resolvePromisify(fn) {
    return arg => new Promise((resolve, reject) => {
        fn(arg, (error, result) => {
            if (error) {
                resolve(error);
            }
            else {
                resolve(result);
            }
        });
    });
}
const resolveTxtPromise = resolvePromisify(dns.resolveTxt);
const dnsLookupPromise = util.promisify(dns.lookup);
/**
 * Attempt to parse a target string as an IP address
 * @param target
 * @return An "IP:port" string in an array if parsing was successful, `null` otherwise
 */
function parseIP(target) {
    /* These three regular expressions are all mutually exclusive, so we just
     * want the first one that matches the target string, if any do. */
    const ipv4Match = IPV4_REGEX.exec(target);
    const match = ipv4Match || IPV6_REGEX.exec(target) || IPV6_BRACKET_REGEX.exec(target);
    if (match === null) {
        return null;
    }
    // ipv6 addresses should be bracketed
    const addr = ipv4Match ? match[1] : `[${match[1]}]`;
    let port;
    if (match[2]) {
        port = match[2];
    }
    else {
        port = DEFAULT_PORT;
    }
    return [`${addr}:${port}`];
}
/**
 * Merge any number of arrays into a single alternating array
 * @param arrays
 */
function mergeArrays(...arrays) {
    const result = [];
    for (let i = 0; i <
        Math.max.apply(null, arrays.map(array => array.length)); i++) {
        for (const array of arrays) {
            if (i < array.length) {
                result.push(array[i]);
            }
        }
    }
    return result;
}
/**
 * Resolver implementation that handles DNS names and IP addresses.
 */
class DnsResolver {
    constructor(target, listener) {
        this.target = target;
        this.listener = listener;
        /* The promise results here contain, in order, the A record, the AAAA record,
         * and either the TXT record or an error if TXT resolution failed */
        this.pendingResultPromise = null;
        trace('Resolver constructed for target ' + target);
        this.ipResult = parseIP(target);
        const dnsMatch = DNS_REGEX.exec(target);
        if (dnsMatch === null) {
            this.dnsHostname = null;
            this.port = null;
        }
        else {
            this.dnsHostname = dnsMatch[1];
            if (dnsMatch[2]) {
                this.port = dnsMatch[2];
            }
            else {
                this.port = DEFAULT_PORT;
            }
        }
        this.percentage = Math.random() * 100;
        this.defaultResolutionError = {
            code: constants_1.Status.UNAVAILABLE,
            details: `Name resolution failed for target ${this.target}`,
            metadata: new metadata_1.Metadata(),
        };
    }
    /**
     * If the target is an IP address, just provide that address as a result.
     * Otherwise, initiate A, AAAA, and TXT
     */
    startResolution() {
        if (this.ipResult !== null) {
            trace('Returning IP address for target ' + this.target);
            setImmediate(() => {
                this.listener.onSuccessfulResolution(this.ipResult, null, null);
            });
            return;
        }
        if (this.dnsHostname !== null) {
            const hostname = this.dnsHostname;
            /* We lookup both address families here and then split them up later
             * because when looking up a single family, dns.lookup outputs an error
             * if the name exists but there are no records for that family, and that
             * error is indistinguishable from other kinds of errors */
            const addressResult = dnsLookupPromise(hostname, { all: true });
            /* We handle the TXT query promise differently than the others because
             * the name resolution attempt as a whole is a success even if the TXT
             * lookup fails */
            const txtResult = resolveTxtPromise(hostname);
            this.pendingResultPromise = Promise.all([addressResult, txtResult]);
            this.pendingResultPromise.then(([addressList, txtRecord]) => {
                this.pendingResultPromise = null;
                const ip4Addresses = addressList
                    .filter(addr => addr.family === 4)
                    .map(addr => `${addr.address}:${this.port}`);
                let ip6Addresses;
                if (semver.satisfies(process.version, IPV6_SUPPORT_RANGE)) {
                    ip6Addresses = addressList
                        .filter(addr => addr.family === 6)
                        .map(addr => `[${addr.address}]:${this.port}`);
                }
                else {
                    ip6Addresses = [];
                }
                const allAddresses = mergeArrays(ip4Addresses, ip6Addresses);
                trace('Resolved addresses for target ' + this.target + ': ' + allAddresses);
                if (allAddresses.length === 0) {
                    this.listener.onError(this.defaultResolutionError);
                    return;
                }
                let serviceConfig = null;
                let serviceConfigError = null;
                if (txtRecord instanceof Error) {
                    serviceConfigError = {
                        code: constants_1.Status.UNAVAILABLE,
                        details: 'TXT query failed',
                        metadata: new metadata_1.Metadata(),
                    };
                }
                else {
                    try {
                        serviceConfig = service_config_1.extractAndSelectServiceConfig(txtRecord, this.percentage);
                    }
                    catch (err) {
                        serviceConfigError = {
                            code: constants_1.Status.UNAVAILABLE,
                            details: 'Parsing service config failed',
                            metadata: new metadata_1.Metadata(),
                        };
                    }
                }
                this.listener.onSuccessfulResolution(allAddresses, serviceConfig, serviceConfigError);
            }, err => {
                trace('Resolution error for target ' +
                    this.target +
                    ': ' +
                    err.message);
                this.pendingResultPromise = null;
                this.listener.onError(this.defaultResolutionError);
            });
        }
    }
    updateResolution() {
        trace('Resolution update requested for target ' + this.target);
        if (this.pendingResultPromise === null) {
            this.startResolution();
        }
    }
    /**
     * Get the default authority for the given target. For IP targets, that is
     * the IP address. For DNS targets, it is the hostname.
     * @param target
     */
    static getDefaultAuthority(target) {
        const ipMatch = IPV4_REGEX.exec(target) ||
            IPV6_REGEX.exec(target) ||
            IPV6_BRACKET_REGEX.exec(target);
        if (ipMatch) {
            return ipMatch[1];
        }
        const dnsMatch = DNS_REGEX.exec(target);
        if (dnsMatch) {
            return dnsMatch[1];
        }
        throw new Error(`Failed to parse target ${target}`);
    }
}
/**
 * Set up the DNS resolver class by registering it as the handler for the
 * "dns:" prefix and as the default resolver.
 */
function setup() {
    resolver_1.registerResolver('dns:', DnsResolver);
    resolver_1.registerDefaultResolver(DnsResolver);
}
exports.setup = setup;
//# sourceMappingURL=resolver-dns.js.map