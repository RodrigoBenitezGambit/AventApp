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
/// <reference types="node" />
import { ApiError, BodyResponseCallback, DecorateRequestOptions, DeleteCallback, ExistsCallback, GetConfig, Metadata, ResponseBody, ServiceObject } from '@google-cloud/common';
import { Acl } from './acl';
import { Channel } from './channel';
import { File, FileOptions, CreateResumableUploadOptions, CreateWriteStreamOptions } from './file';
import { Iam } from './iam';
import { Notification } from './notification';
import { Storage } from './storage';
interface BucketOptions {
    userProject?: string;
}
export declare type GetFilesResponse = [File[], {}, Metadata];
export interface GetFilesCallback {
    (err: Error | null, files?: File[], nextQuery?: {}, apiResponse?: Metadata): void;
}
interface WatchAllOptions {
    delimiter?: string;
    maxResults?: number;
    pageToken?: string;
    prefix?: string;
    projection?: string;
    userProject?: string;
    versions?: boolean;
}
export interface AddLifecycleRuleOptions {
    append?: boolean;
}
export interface LifecycleRule {
    action: {
        type: string;
        storageClass?: string;
    } | string;
    condition: {
        [key: string]: boolean | Date | number | string;
    };
    storageClass?: string;
}
export interface EnableLoggingOptions {
    bucket?: string | Bucket;
    prefix: string;
}
export interface GetFilesOptions {
    autoPaginate?: boolean;
    delimiter?: string;
    directory?: string;
    prefix?: string;
    maxApiCalls?: number;
    maxResults?: number;
    pageToken?: string;
    userProject?: string;
    versions?: boolean;
}
export interface CombineOptions {
    kmsKeyName?: string;
    userProject?: string;
}
export interface CombineCallback {
    (err: Error | null, newFile: File | null, apiResponse: Metadata): void;
}
export declare type CombineResponse = [File, Metadata];
export interface CreateChannelConfig extends WatchAllOptions {
    address: string;
}
export interface CreateChannelOptions {
    userProject?: string;
}
export declare type CreateChannelResponse = [Channel, Metadata];
export interface CreateChannelCallback {
    (err: Error | null, channel: Channel | null, apiResponse: Metadata): void;
}
export interface CreateNotificationOptions {
    customAttributes?: {
        [key: string]: string;
    };
    eventTypes?: string[];
    objectNamePrefix?: string;
    payloadFormat?: string;
    userProject?: string;
}
export interface CreateNotificationCallback {
    (err: Error | null, notification: Notification | null, apiResponse: Metadata): void;
}
export declare type CreateNotificationResponse = [Notification, Metadata];
export interface DeleteBucketOptions {
    userProject?: string;
}
export declare type DeleteBucketResponse = [Metadata];
export interface DeleteBucketCallback extends DeleteCallback {
    (err: Error | null, apiResponse: Metadata): void;
}
export interface DeleteFilesOptions extends GetFilesOptions {
    force?: boolean;
}
export interface DeleteFilesCallback {
    (err: Error | Error[] | null, apiResponse?: object): void;
}
export declare type DeleteLabelsResponse = [Metadata];
export interface DeleteLabelsCallback extends SetLabelsCallback {
}
export declare type DisableRequesterPaysResponse = [Metadata];
export interface DisableRequesterPaysCallback {
    (err?: Error | null, apiResponse?: object): void;
}
export declare type EnableRequesterPaysResponse = [Metadata];
export interface EnableRequesterPaysCallback {
    (err?: Error | null, apiResponse?: Metadata): void;
}
export interface BucketExistsOptions extends GetConfig {
    userProject?: string;
}
export declare type BucketExistsResponse = [boolean];
export interface BucketExistsCallback extends ExistsCallback {
}
export interface GetBucketOptions extends GetConfig {
    userProject?: string;
}
export declare type GetBucketResponse = [Bucket, Metadata];
export interface GetBucketCallback {
    (err: ApiError | null, bucket: Bucket | null, apiResponse: Metadata): void;
}
export interface GetLabelsOptions {
    userProject?: string;
}
export declare type GetLabelsResponse = [Metadata];
export interface GetLabelsCallback {
    (err: Error | null, labels: object | null): void;
}
export declare type GetBucketMetadataResponse = [Metadata, Metadata];
export interface GetBucketMetadataCallback {
    (err: ApiError | null, metadata: Metadata | null, apiResponse: Metadata): void;
}
export interface GetBucketMetadataOptions {
    userProject?: string;
}
export interface GetNotificationsOptions {
    userProject?: string;
}
export interface GetNotificationsCallback {
    (err: Error | null, notifications: Notification[] | null, apiResponse: Metadata): void;
}
export declare type GetNotificationsResponse = [Notification[], Metadata];
export interface MakeBucketPrivateOptions {
    includeFiles?: boolean;
    force?: boolean;
    userProject?: string;
}
export declare type MakeBucketPrivateResponse = [File[]];
export interface MakeBucketPrivateCallback {
    (err?: Error | null, files?: File[]): void;
}
export interface MakeBucketPublicOptions {
    includeFiles?: boolean;
    force?: boolean;
}
export interface MakeBucketPublicCallback {
    (err?: Error | null, files?: File[]): void;
}
export declare type MakeBucketPublicResponse = [File[]];
export interface SetBucketMetadataOptions {
    userProject?: string;
}
export declare type SetBucketMetadataResponse = [Metadata];
export interface SetBucketMetadataCallback {
    (err?: Error | null, metadata?: Metadata): void;
}
export interface BucketLockCallback {
    (err?: Error | null, apiResponse?: Metadata): void;
}
export declare type BucketLockResponse = [Metadata];
export interface Labels {
    [key: string]: string;
}
export interface SetLabelsOptions {
    userProject?: string;
}
export declare type SetLabelsResponse = [Metadata];
export interface SetLabelsCallback {
    (err?: Error | null, metadata?: Metadata): void;
}
export interface SetBucketStorageClassOptions {
    userProject?: string;
}
export interface SetBucketStorageClassCallback {
    (err?: Error | null): void;
}
export declare type UploadResponse = [File, Metadata];
export interface UploadCallback {
    (err: Error | null, file?: File | null, apiResponse?: Metadata): void;
}
export interface UploadOptions extends CreateResumableUploadOptions, CreateWriteStreamOptions {
    destination?: string | File;
    encryptionKey?: string | Buffer;
    kmsKeyName?: string;
    resumable?: boolean;
}
export interface MakeAllFilesPublicPrivateOptions {
    force?: boolean;
    private?: boolean;
    public?: boolean;
    userProject?: string;
}
interface MakeAllFilesPublicPrivateCallback {
    (err?: Error | Error[] | null, files?: File[]): void;
}
declare type MakeAllFilesPublicPrivateResponse = [File[]];
/**
 * Create a Bucket object to interact with a Cloud Storage bucket.
 *
 * @class
 * @hideconstructor
 *
 * @param {Storage} storage A {@link Storage} instance.
 * @param {string} name The name of the bucket.
 * @param {object} [options] Configuration object.
 * @param {string} [options.userProject] User project.
 *
 * @example
 * const {Storage} = require('@google-cloud/storage');
 * const storage = new Storage();
 * const bucket = storage.bucket('albums');
 */
declare class Bucket extends ServiceObject {
    /**
     * The bucket's name.
     * @name Bucket#name
     * @type {string}
     */
    name: string;
    /**
     * A reference to the {@link Storage} associated with this {@link Bucket}
     * instance.
     * @name Bucket#storage
     * @type {Storage}
     */
    storage: Storage;
    /**
     * A user project to apply to each request from this bucket.
     * @name Bucket#userProject
     * @type {string}
     */
    userProject?: string;
    /**
     * Cloud Storage uses access control lists (ACLs) to manage object and
     * bucket access. ACLs are the mechanism you use to share objects with other
     * users and allow other users to access your buckets and objects.
     *
     * An ACL consists of one or more entries, where each entry grants permissions
     * to an entity. Permissions define the actions that can be performed against
     * an object or bucket (for example, `READ` or `WRITE`); the entity defines
     * who the permission applies to (for example, a specific user or group of
     * users).
     *
     * The `acl` object on a Bucket instance provides methods to get you a list of
     * the ACLs defined on your bucket, as well as set, update, and delete them.
     *
     * Buckets also have
     * [default
     * ACLs](https://cloud.google.com/storage/docs/access-control/lists#default)
     * for all created files. Default ACLs specify permissions that all new
     * objects added to the bucket will inherit by default. You can add, delete,
     * get, and update entities and permissions for these as well with
     * {@link Bucket#acl.default}.
     *
     * @see [About Access Control Lists]{@link http://goo.gl/6qBBPO}
     * @see [Default ACLs]{@link https://cloud.google.com/storage/docs/access-control/lists#default}
     *
     * @name Bucket#acl
     * @mixes Acl
     * @property {Acl} default Cloud Storage Buckets have
     * [default
     * ACLs](https://cloud.google.com/storage/docs/access-control/lists#default)
     * for all created files. You can add, delete, get, and update entities and
     * permissions for these as well. The method signatures and examples are all
     * the same, after only prefixing the method call with `default`.
     *
     * @example
     * const {Storage} = require('@google-cloud/storage');
     * const storage = new Storage();
     *
     * //-
     * // Make a bucket's contents publicly readable.
     * //-
     * const myBucket = storage.bucket('my-bucket');
     *
     * const options = {
     *   entity: 'allUsers',
     *   role: storage.acl.READER_ROLE
     * };
     *
     * myBucket.acl.add(options, function(err, aclObject) {});
     *
     * //-
     * // If the callback is omitted, we'll return a Promise.
     * //-
     * myBucket.acl.add(options).then(function(data) {
     *   const aclObject = data[0];
     *   const apiResponse = data[1];
     * });
     *
     * @example <caption>include:samples/acl.js</caption>
     * region_tag:storage_print_bucket_acl
     * Example of printing a bucket's ACL:
     *
     * @example <caption>include:samples/acl.js</caption>
     * region_tag:storage_print_bucket_acl_for_user
     * Example of printing a bucket's ACL for a specific user:
     *
     * @example <caption>include:samples/acl.js</caption>
     * region_tag:storage_add_bucket_owner
     * Example of adding an owner to a bucket:
     *
     * @example <caption>include:samples/acl.js</caption>
     * region_tag:storage_remove_bucket_owner
     * Example of removing an owner from a bucket:
     *
     * @example <caption>include:samples/acl.js</caption>
     * region_tag:storage_add_bucket_default_owner
     * Example of adding a default owner to a bucket:
     *
     * @example <caption>include:samples/acl.js</caption>
     * region_tag:storage_remove_bucket_default_owner
     * Example of removing a default owner from a bucket:
     */
    acl: Acl;
    /**
     * Get and set IAM policies for your bucket.
     *
     * @name Bucket#iam
     * @mixes Iam
     *
     * @see [Cloud Storage IAM Management](https://cloud.google.com/storage/docs/access-control/iam#short_title_iam_management)
     * @see [Granting, Changing, and Revoking Access](https://cloud.google.com/iam/docs/granting-changing-revoking-access)
     * @see [IAM Roles](https://cloud.google.com/iam/docs/understanding-roles)
     *
     * @example
     * const {Storage} = require('@google-cloud/storage');
     * const storage = new Storage();
     * const bucket = storage.bucket('albums');
     *
     * //-
     * // Get the IAM policy for your bucket.
     * //-
     * bucket.iam.getPolicy(function(err, policy) {
     *   console.log(policy);
     * });
     *
     * //-
     * // If the callback is omitted, we'll return a Promise.
     * //-
     * bucket.iam.getPolicy().then(function(data) {
     *   const policy = data[0];
     *   const apiResponse = data[1];
     * });
     *
     * @example <caption>include:samples/iam.js</caption>
     * region_tag:storage_view_bucket_iam_members
     * Example of retrieving a bucket's IAM policy:
     *
     * @example <caption>include:samples/iam.js</caption>
     * region_tag:storage_add_bucket_iam_member
     * Example of adding to a bucket's IAM policy:
     *
     * @example <caption>include:samples/iam.js</caption>
     * region_tag:storage_remove_bucket_iam_member
     * Example of removing from a bucket's IAM policy:
     */
    iam: Iam;
    /**
     * Get {@link File} objects for the files currently in the bucket as a
     * readable object stream.
     *
     * @method Bucket#getFilesStream
     * @param {GetFilesOptions} [query] Query object for listing files.
     * @returns {ReadableStream} A readable stream that emits {@link File} instances.
     *
     * @example
     * const {Storage} = require('@google-cloud/storage');
     * const storage = new Storage();
     * const bucket = storage.bucket('albums');
     *
     * bucket.getFilesStream()
     *   .on('error', console.error)
     *   .on('data', function(file) {
     *     // file is a File object.
     *   })
     *   .on('end', function() {
     *     // All files retrieved.
     *   });
     *
     * //-
     * // If you anticipate many results, you can end a stream early to prevent
     * // unnecessary processing and API requests.
     * //-
     * bucket.getFilesStream()
     *   .on('data', function(file) {
     *     this.end();
     *   });
     *
     * //-
     * // If you're filtering files with a delimiter, you should use
     * // {@link Bucket#getFiles} and set `autoPaginate: false` in order to
     * // preserve the `apiResponse` argument.
     * //-
     * const prefixes = [];
     *
     * function callback(err, files, nextQuery, apiResponse) {
     *   prefixes = prefixes.concat(apiResponse.prefixes);
     *
     *   if (nextQuery) {
     *     bucket.getFiles(nextQuery, callback);
     *   } else {
     *     // prefixes = The finished array of prefixes.
     *   }
     * }
     *
     * bucket.getFiles({
     *   autoPaginate: false,
     *   delimiter: '/'
     * }, callback);
     */
    getFilesStream: Function;
    constructor(storage: Storage, name: string, options?: BucketOptions);
    addLifecycleRule(rule: LifecycleRule, options?: AddLifecycleRuleOptions): Promise<SetBucketMetadataResponse>;
    addLifecycleRule(rule: LifecycleRule, options: AddLifecycleRuleOptions, callback: SetBucketMetadataCallback): void;
    addLifecycleRule(rule: LifecycleRule, callback: SetBucketMetadataCallback): void;
    combine(sources: string[] | File[], destination: string | File, options?: CombineOptions): Promise<CombineResponse>;
    combine(sources: string[] | File[], destination: string | File, options: CombineOptions, callback: CombineCallback): void;
    combine(sources: string[] | File[], destination: string | File, callback: CombineCallback): void;
    createChannel(id: string, config: CreateChannelConfig, options?: CreateChannelOptions): Promise<CreateChannelResponse>;
    createChannel(id: string, config: CreateChannelConfig, callback: CreateChannelCallback): void;
    createChannel(id: string, config: CreateChannelConfig, options: CreateChannelOptions, callback: CreateChannelCallback): void;
    createNotification(topic: string, options?: CreateNotificationOptions): Promise<CreateNotificationResponse>;
    createNotification(topic: string, options: CreateNotificationOptions, callback: CreateNotificationCallback): void;
    createNotification(topic: string, callback: CreateNotificationCallback): void;
    deleteFiles(query?: DeleteFilesOptions): Promise<void>;
    deleteFiles(callback: DeleteFilesCallback): void;
    deleteFiles(query: DeleteFilesOptions, callback: DeleteFilesCallback): void;
    deleteLabels(labels?: string | string[]): Promise<DeleteLabelsResponse>;
    deleteLabels(callback: DeleteLabelsCallback): void;
    deleteLabels(labels: string | string[], callback: DeleteLabelsCallback): void;
    disableRequesterPays(): Promise<DisableRequesterPaysResponse>;
    disableRequesterPays(callback: DisableRequesterPaysCallback): void;
    enableLogging(config: EnableLoggingOptions): Promise<SetBucketMetadataResponse>;
    enableLogging(config: EnableLoggingOptions, callback: SetBucketMetadataCallback): void;
    enableRequesterPays(): Promise<EnableRequesterPaysResponse>;
    enableRequesterPays(callback: EnableRequesterPaysCallback): void;
    /**
     * Create a {@link File} object. See {@link File} to see how to handle
     * the different use cases you may have.
     *
     * @param {string} name The name of the file in this bucket.
     * @param {object} [options] Configuration options.
     * @param {string|number} [options.generation] Only use a specific revision of
     *     this file.
     * @param {string} [options.encryptionKey] A custom encryption key. See
     *     [Customer-supplied Encryption
     * Keys](https://cloud.google.com/storage/docs/encryption#customer-supplied).
     * @param {string} [options.kmsKeyName] The name of the Cloud KMS key that will
     *     be used to encrypt the object. Must be in the format:
     *     `projects/my-project/locations/location/keyRings/my-kr/cryptoKeys/my-key`.
     *     KMS key ring must use the same location as the bucket.
     * @returns {File}
     *
     * @example
     * const {Storage} = require('@google-cloud/storage');
     * const storage = new Storage();
     * const bucket = storage.bucket('albums');
     * const file = bucket.file('my-existing-file.png');
     */
    file(name: string, options?: FileOptions): File;
    getFiles(query?: GetFilesOptions): Promise<GetFilesResponse>;
    getFiles(query: GetFilesOptions, callback: GetFilesCallback): void;
    getFiles(callback: GetFilesCallback): void;
    getLabels(options: GetLabelsOptions): Promise<GetLabelsResponse>;
    getLabels(callback: GetLabelsCallback): void;
    getLabels(options: GetLabelsOptions, callback: GetLabelsCallback): void;
    getNotifications(options?: GetNotificationsOptions): Promise<GetNotificationsResponse>;
    getNotifications(callback: GetNotificationsCallback): void;
    getNotifications(options: GetNotificationsOptions, callback: GetNotificationsCallback): void;
    lock(metageneration: number | string): Promise<BucketLockResponse>;
    lock(metageneration: number | string, callback: BucketLockCallback): void;
    makePrivate(options?: MakeBucketPrivateOptions): Promise<MakeBucketPrivateResponse>;
    makePrivate(callback: MakeBucketPrivateCallback): void;
    makePrivate(options: MakeBucketPrivateOptions, callback: MakeBucketPrivateCallback): void;
    makePublic(options?: MakeBucketPublicOptions): Promise<MakeBucketPublicResponse>;
    makePublic(callback: MakeBucketPublicCallback): void;
    makePublic(options: MakeBucketPublicOptions, callback: MakeBucketPublicCallback): void;
    /**
     * Get a reference to a Cloud Pub/Sub Notification.
     *
     * @param {string} id ID of notification.
     * @returns {Notification}
     * @see Notification
     *
     * @example
     * const {Storage} = require('@google-cloud/storage');
     * const storage = new Storage();
     * const bucket = storage.bucket('my-bucket');
     * const notification = bucket.notification('1');
     */
    notification(id: string): Notification;
    removeRetentionPeriod(): Promise<SetBucketMetadataResponse>;
    removeRetentionPeriod(callback: SetBucketMetadataCallback): void;
    request(reqOpts: DecorateRequestOptions): Promise<[ResponseBody, Metadata]>;
    request(reqOpts: DecorateRequestOptions, callback: BodyResponseCallback): void;
    setLabels(labels: Labels, options?: SetLabelsOptions): Promise<SetLabelsResponse>;
    setLabels(labels: Labels, callback: SetLabelsCallback): void;
    setLabels(labels: Labels, options: SetLabelsOptions, callback: SetLabelsCallback): void;
    setRetentionPeriod(duration: number): Promise<SetBucketMetadataResponse>;
    setRetentionPeriod(duration: number, callback: SetBucketMetadataCallback): void;
    setStorageClass(storageClass: string, options?: SetBucketStorageClassOptions): Promise<SetBucketMetadataResponse>;
    setStorageClass(storageClass: string, callback: SetBucketStorageClassCallback): void;
    setStorageClass(storageClass: string, options: SetBucketStorageClassOptions, callback: SetBucketStorageClassCallback): void;
    /**
     * Set a user project to be billed for all requests made from this Bucket
     * object and any files referenced from this Bucket object.
     *
     * @param {string} userProject The user project.
     *
     * @example
     * const {Storage} = require('@google-cloud/storage');
     * const storage = new Storage();
     * const bucket = storage.bucket('albums');
     *
     * bucket.setUserProject('grape-spaceship-123');
     */
    setUserProject(userProject: string): void;
    upload(pathString: string, options?: UploadOptions): Promise<UploadResponse>;
    upload(pathString: string, options: UploadOptions, callback: UploadCallback): void;
    upload(pathString: string, callback: UploadCallback): void;
    makeAllFilesPublicPrivate_(options?: MakeAllFilesPublicPrivateOptions): Promise<MakeAllFilesPublicPrivateResponse>;
    makeAllFilesPublicPrivate_(callback: MakeAllFilesPublicPrivateCallback): void;
    makeAllFilesPublicPrivate_(options: MakeAllFilesPublicPrivateOptions, callback: MakeAllFilesPublicPrivateCallback): void;
    getId(): string;
}
/**
 * Reference to the {@link Bucket} class.
 * @name module:@google-cloud/storage.Bucket
 * @see Bucket
 */
export { Bucket };
