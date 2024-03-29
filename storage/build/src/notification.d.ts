/**
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Metadata, MetadataCallback, ServiceObject } from '@google-cloud/common';
import { ResponseBody } from '@google-cloud/common/build/src/util';
import { Bucket } from './bucket';
export interface DeleteNotificationOptions {
    userProject?: string;
}
export interface GetNotificationMetadataOptions {
    userProject?: string;
}
/**
 * @typedef {array} GetNotificationMetadataResponse
 * @property {object} 0 The notification metadata.
 * @property {object} 1 The full API response.
 */
export declare type GetNotificationMetadataResponse = [ResponseBody, Metadata];
/**
 * @callback GetNotificationMetadataCallback
 * @param {?Error} err Request error, if any.
 * @param {object} files The notification metadata.
 * @param {object} apiResponse The full API response.
 */
export interface GetNotificationMetadataCallback {
    (err: Error | null, metadata?: ResponseBody, apiResponse?: Metadata): void;
}
/**
 * @typedef {array} GetNotificationResponse
 * @property {Notification} 0 The {@link Notification}
 * @property {object} 1 The full API response.
 */
export declare type GetNotificationResponse = [Notification, Metadata];
export interface GetNotificationOptions {
    /**
     * Automatically create the object if it does not exist. Default: `false`.
     */
    autoCreate?: boolean;
    /**
     * The ID of the project which will be billed for the request.
     */
    userProject?: string;
}
/**
 * @callback GetNotificationCallback
 * @param {?Error} err Request error, if any.
 * @param {Notification} notification The {@link Notification}.
 * @param {object} apiResponse The full API response.
 */
export interface GetNotificationCallback {
    (err: Error | null, notification?: Notification | null, apiResponse?: Metadata): void;
}
/**
 * @callback DeleteNotificationCallback
 * @param {?Error} err Request error, if any.
 * @param {object} apiResponse The full API response.
 */
export interface DeleteNotificationCallback {
    (err: Error | null, apiResponse?: Metadata): void;
}
/**
 * A Notification object is created from your {@link Bucket} object using
 * {@link Bucket#notification}. Use it to interact with Cloud Pub/Sub
 * notifications.
 *
 * @see [Cloud Pub/Sub Notifications for Google Cloud Storage]{@link https://cloud.google.com/storage/docs/pubsub-notifications}
 *
 * @class
 * @hideconstructor
 *
 * @param {Bucket} bucket The bucket instance this notification is attached to.
 * @param {string} id The ID of the notification.
 *
 * @example
 * const {Storage} = require('@google-cloud/storage');
 * const storage = new Storage();
 * const myBucket = storage.bucket('my-bucket');
 *
 * const notification = myBucket.notification('1');
 */
declare class Notification extends ServiceObject {
    constructor(bucket: Bucket, id: string);
    delete(options?: DeleteNotificationOptions): Promise<[Metadata]>;
    delete(options: DeleteNotificationOptions, callback: DeleteNotificationCallback): void;
    delete(callback: DeleteNotificationCallback): void;
    get(options?: GetNotificationOptions): Promise<GetNotificationResponse>;
    get(options: GetNotificationOptions, callback: GetNotificationCallback): void;
    get(callback: GetNotificationCallback): void;
    getMetadata(options?: GetNotificationMetadataOptions): Promise<GetNotificationMetadataResponse>;
    getMetadata(options: GetNotificationMetadataOptions, callback: MetadataCallback): void;
    getMetadata(callback: MetadataCallback): void;
}
/**
 * Reference to the {@link Notification} class.
 * @name module:@google-cloud/storage.Notification
 * @see Notification
 */
export { Notification };
