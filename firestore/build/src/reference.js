"use strict";
/*!
 * Copyright 2017 Google Inc. All Rights Reserved.
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
Object.defineProperty(exports, "__esModule", { value: true });
const deepEqual = require('deep-equal');
const bun = require("bun");
const through2 = require("through2");
const document_1 = require("./document");
const document_change_1 = require("./document-change");
const logger_1 = require("./logger");
const order_1 = require("./order");
const path_1 = require("./path");
const serializer_1 = require("./serializer");
const timestamp_1 = require("./timestamp");
const util_1 = require("./util");
const validate_1 = require("./validate");
const watch_1 = require("./watch");
const write_batch_1 = require("./write-batch");
/**
 * The direction of a `Query.orderBy()` clause is specified as 'desc' or 'asc'
 * (descending or ascending).
 *
 * @private
 */
const directionOperators = {
    asc: 'ASCENDING',
    desc: 'DESCENDING',
};
/**
 * Filter conditions in a `Query.where()` clause are specified using the
 * strings '<', '<=', '==', '>=', '>', 'array-contains', 'in', and
 * 'array-contains-any'.
 *
 * @private
 */
const comparisonOperators = {
    '<': 'LESS_THAN',
    '<=': 'LESS_THAN_OR_EQUAL',
    '==': 'EQUAL',
    '>': 'GREATER_THAN',
    '>=': 'GREATER_THAN_OR_EQUAL',
    'array-contains': 'ARRAY_CONTAINS',
    in: 'IN',
    'array-contains-any': 'ARRAY_CONTAINS_ANY',
};
/**
 * onSnapshot() callback that receives a QuerySnapshot.
 *
 * @callback querySnapshotCallback
 * @param {QuerySnapshot} snapshot A query snapshot.
 */
/**
 * onSnapshot() callback that receives a DocumentSnapshot.
 *
 * @callback documentSnapshotCallback
 * @param {DocumentSnapshot} snapshot A document snapshot.
 */
/**
 * onSnapshot() callback that receives an error.
 *
 * @callback errorCallback
 * @param {Error} err An error from a listen.
 */
/**
 * A DocumentReference refers to a document location in a Firestore database
 * and can be used to write, read, or listen to the location. The document at
 * the referenced location may or may not exist. A DocumentReference can
 * also be used to create a
 * [CollectionReference]{@link CollectionReference} to a
 * subcollection.
 *
 * @class
 */
class DocumentReference {
    /**
     * @hideconstructor
     *
     * @param _firestore The Firestore Database client.
     * @param _path The Path of this reference.
     */
    constructor(_firestore, _path) {
        this._firestore = _firestore;
        this._path = _path;
    }
    /**
     * The string representation of the DocumentReference's location.
     * @private
     * @type {string}
     * @name DocumentReference#formattedName
     */
    get formattedName() {
        const projectId = this.firestore.projectId;
        return this._path.toQualifiedResourcePath(projectId).formattedName;
    }
    /**
     * The [Firestore]{@link Firestore} instance for the Firestore
     * database (useful for performing transactions, etc.).
     *
     * @type {Firestore}
     * @name DocumentReference#firestore
     * @readonly
     *
     * @example
     * let collectionRef = firestore.collection('col');
     *
     * collectionRef.add({foo: 'bar'}).then(documentReference => {
     *   let firestore = documentReference.firestore;
     *   console.log(`Root location for document is ${firestore.formattedName}`);
     * });
     */
    get firestore() {
        return this._firestore;
    }
    /**
     * A string representing the path of the referenced document (relative
     * to the root of the database).
     *
     * @type {string}
     * @name DocumentReference#path
     * @readonly
     *
     * @example
     * let collectionRef = firestore.collection('col');
     *
     * collectionRef.add({foo: 'bar'}).then(documentReference => {
     *   console.log(`Added document at '${documentReference.path}'`);
     * });
     */
    get path() {
        return this._path.relativeName;
    }
    /**
     * The last path element of the referenced document.
     *
     * @type {string}
     * @name DocumentReference#id
     * @readonly
     *
     * @example
     * let collectionRef = firestore.collection('col');
     *
     * collectionRef.add({foo: 'bar'}).then(documentReference => {
     *   console.log(`Added document with name '${documentReference.id}'`);
     * });
     */
    get id() {
        return this._path.id;
    }
    /**
     * A reference to the collection to which this DocumentReference belongs.
     *
     * @name DocumentReference#parent
     * @type {CollectionReference}
     * @readonly
     *
     * @example
     * let documentRef = firestore.doc('col/doc');
     * let collectionRef = documentRef.parent;
     *
     * collectionRef.where('foo', '==', 'bar').get().then(results => {
     *   console.log(`Found ${results.size} matches in parent collection`);
     * }):
     */
    get parent() {
        return new CollectionReference(this._firestore, this._path.parent());
    }
    /**
     * Reads the document referred to by this DocumentReference.
     *
     * @returns {Promise.<DocumentSnapshot>} A Promise resolved with a
     * DocumentSnapshot for the retrieved document on success. For missing
     * documents, DocumentSnapshot.exists will be false. If the get() fails for
     * other reasons, the Promise will be rejected.
     *
     * @example
     * let documentRef = firestore.doc('col/doc');
     *
     * documentRef.get().then(documentSnapshot => {
     *   if (documentSnapshot.exists) {
     *     console.log('Document retrieved successfully.');
     *   }
     * });
     */
    get() {
        return this._firestore.getAll(this).then(([result]) => result);
    }
    /**
     * Gets a [CollectionReference]{@link CollectionReference} instance
     * that refers to the collection at the specified path.
     *
     * @param {string} collectionPath A slash-separated path to a collection.
     * @returns {CollectionReference} A reference to the new
     * subcollection.
     *
     * @example
     * let documentRef = firestore.doc('col/doc');
     * let subcollection = documentRef.collection('subcollection');
     * console.log(`Path to subcollection: ${subcollection.path}`);
     */
    collection(collectionPath) {
        path_1.validateResourcePath('collectionPath', collectionPath);
        const path = this._path.append(collectionPath);
        if (!path.isCollection) {
            throw new Error(`Value for argument "collectionPath" must point to a collection, but was "${collectionPath}". Your path does not contain an odd number of components.`);
        }
        return new CollectionReference(this._firestore, path);
    }
    /**
     * Fetches the subcollections that are direct children of this document.
     *
     * @returns {Promise.<Array.<CollectionReference>>} A Promise that resolves
     * with an array of CollectionReferences.
     *
     * @example
     * let documentRef = firestore.doc('col/doc');
     *
     * documentRef.listCollections().then(collections => {
     *   for (let collection of collections) {
     *     console.log(`Found subcollection with id: ${collection.id}`);
     *   }
     * });
     */
    listCollections() {
        const tag = util_1.requestTag();
        return this.firestore.initializeIfNeeded(tag).then(() => {
            const request = { parent: this.formattedName };
            return this._firestore
                .request('listCollectionIds', request, tag, 
            /* allowRetries= */ true)
                .then(collectionIds => {
                const collections = [];
                // We can just sort this list using the default comparator since it
                // will only contain collection ids.
                collectionIds.sort();
                for (const collectionId of collectionIds) {
                    collections.push(this.collection(collectionId));
                }
                return collections;
            });
        });
    }
    /**
     * Create a document with the provided object values. This will fail the write
     * if a document exists at its location.
     *
     * @param {DocumentData} data An object that contains the fields and data to
     * serialize as the document.
     * @returns {Promise.<WriteResult>} A Promise that resolves with the
     * write time of this create.
     *
     * @example
     * let documentRef = firestore.collection('col').doc();
     *
     * documentRef.create({foo: 'bar'}).then((res) => {
     *   console.log(`Document created at ${res.updateTime}`);
     * }).catch((err) => {
     *   console.log(`Failed to create document: ${err}`);
     * });
     */
    create(data) {
        const writeBatch = new write_batch_1.WriteBatch(this._firestore);
        return writeBatch
            .create(this, data)
            .commit()
            .then(([writeResult]) => writeResult);
    }
    /**
     * Deletes the document referred to by this `DocumentReference`.
     *
     * A delete for a non-existing document is treated as a success (unless
     * lastUptimeTime is provided).
     *
     * @param {Precondition=} precondition A precondition to enforce for this
     * delete.
     * @param {Timestamp=} precondition.lastUpdateTime If set, enforces that the
     * document was last updated at lastUpdateTime. Fails the delete if the
     * document was last updated at a different time.
     * @returns {Promise.<WriteResult>} A Promise that resolves with the
     * delete time.
     *
     * @example
     * let documentRef = firestore.doc('col/doc');
     *
     * documentRef.delete().then(() => {
     *   console.log('Document successfully deleted.');
     * });
     */
    delete(precondition) {
        const writeBatch = new write_batch_1.WriteBatch(this._firestore);
        return writeBatch
            .delete(this, precondition)
            .commit()
            .then(([writeResult]) => writeResult);
    }
    /**
     * Writes to the document referred to by this DocumentReference. If the
     * document does not yet exist, it will be created. If you pass
     * [SetOptions]{@link SetOptions}, the provided data can be merged into an
     * existing document.
     *
     * @param {DocumentData} data A map of the fields and values for the document.
     * @param {SetOptions=} options An object to configure the set behavior.
     * @param {boolean=} options.merge If true, set() merges the values specified
     * in its data argument. Fields omitted from this set() call remain untouched.
     * @param {Array.<string|FieldPath>=} options.mergeFields If provided,
     * set() only replaces the specified field paths. Any field path that is not
     * specified is ignored and remains untouched.
     * @returns {Promise.<WriteResult>} A Promise that resolves with the
     * write time of this set.
     *
     * @example
     * let documentRef = firestore.doc('col/doc');
     *
     * documentRef.set({foo: 'bar'}).then(res => {
     *   console.log(`Document written at ${res.updateTime}`);
     * });
     */
    set(data, options) {
        const writeBatch = new write_batch_1.WriteBatch(this._firestore);
        return writeBatch
            .set(this, data, options)
            .commit()
            .then(([writeResult]) => writeResult);
    }
    /**
     * Updates fields in the document referred to by this DocumentReference.
     * If the document doesn't yet exist, the update fails and the returned
     * Promise will be rejected.
     *
     * The update() method accepts either an object with field paths encoded as
     * keys and field values encoded as values, or a variable number of arguments
     * that alternate between field paths and field values.
     *
     * A Precondition restricting this update can be specified as the last
     * argument.
     *
     * @param {UpdateData|string|FieldPath} dataOrField An object containing the
     * fields and values with which to update the document or the path of the
     * first field to update.
     * @param {
     * ...(*|string|FieldPath|Precondition)} preconditionOrValues An alternating
     * list of field paths and values to update or a Precondition to restrict
     * this update.
     * @returns {Promise.<WriteResult>} A Promise that resolves once the
     * data has been successfully written to the backend.
     *
     * @example
     * let documentRef = firestore.doc('col/doc');
     *
     * documentRef.update({foo: 'bar'}).then(res => {
     *   console.log(`Document updated at ${res.updateTime}`);
     * });
     */
    update(dataOrField, ...preconditionOrValues) {
        validate_1.validateMinNumberOfArguments('DocumentReference.update', arguments, 1);
        const writeBatch = new write_batch_1.WriteBatch(this._firestore);
        return writeBatch.update
            .apply(writeBatch, [this, dataOrField, ...preconditionOrValues])
            .commit()
            .then(([writeResult]) => writeResult);
    }
    /**
     * Attaches a listener for DocumentSnapshot events.
     *
     * @param {documentSnapshotCallback} onNext A callback to be called every
     * time a new `DocumentSnapshot` is available.
     * @param {errorCallback=} onError A callback to be called if the listen fails
     * or is cancelled. No further callbacks will occur. If unset, errors will be
     * logged to the console.
     *
     * @returns {function()} An unsubscribe function that can be called to cancel
     * the snapshot listener.
     *
     * @example
     * let documentRef = firestore.doc('col/doc');
     *
     * let unsubscribe = documentRef.onSnapshot(documentSnapshot => {
     *   if (documentSnapshot.exists) {
     *     console.log(documentSnapshot.data());
     *   }
     * }, err => {
     *   console.log(`Encountered error: ${err}`);
     * });
     *
     * // Remove this listener.
     * unsubscribe();
     */
    onSnapshot(onNext, onError) {
        validate_1.validateFunction('onNext', onNext);
        validate_1.validateFunction('onError', onError, { optional: true });
        const watch = new watch_1.DocumentWatch(this.firestore, this);
        return watch.onSnapshot((readTime, size, docs) => {
            for (const document of docs()) {
                if (document.ref.path === this.path) {
                    onNext(document);
                    return;
                }
            }
            // The document is missing.
            const document = new document_1.DocumentSnapshotBuilder();
            document.ref = new DocumentReference(this._firestore, this._path);
            document.readTime = readTime;
            onNext(document.build());
        }, onError || console.error);
    }
    /**
     * Returns true if this `DocumentReference` is equal to the provided value.
     *
     * @param {*} other The value to compare against.
     * @return {boolean} true if this `DocumentReference` is equal to the provided
     * value.
     */
    isEqual(other) {
        return (this === other ||
            (other instanceof DocumentReference &&
                this._firestore === other._firestore &&
                this._path.isEqual(other._path)));
    }
    /**
     * Converts this DocumentReference to the Firestore Proto representation.
     *
     * @private
     */
    toProto() {
        return { referenceValue: this.formattedName };
    }
}
exports.DocumentReference = DocumentReference;
/**
 * A Query order-by field.
 *
 * @private
 * @class
 */
class FieldOrder {
    /**
     * @param field The name of a document field (member) on which to order query
     * results.
     * @param direction One of 'ASCENDING' (default) or 'DESCENDING' to
     * set the ordering direction to ascending or descending, respectively.
     */
    constructor(field, direction = 'ASCENDING') {
        this.field = field;
        this.direction = direction;
    }
    /**
     * Generates the proto representation for this field order.
     * @private
     */
    toProto() {
        return {
            field: {
                fieldPath: this.field.formattedName,
            },
            direction: this.direction,
        };
    }
}
/**
 * A field constraint for a Query where clause.
 *
 * @private
 * @class
 */
class FieldFilter {
    /**
     * @param serializer The Firestore serializer
     * @param field The path of the property value to compare.
     * @param op A comparison operation.
     * @param value The value to which to compare the field for inclusion in a
     * query.
     */
    constructor(serializer, field, op, value) {
        this.serializer = serializer;
        this.field = field;
        this.op = op;
        this.value = value;
    }
    /**
     * Returns whether this FieldFilter uses an equals comparison.
     *
     * @private
     */
    isInequalityFilter() {
        switch (this.op) {
            case 'GREATER_THAN':
            case 'GREATER_THAN_OR_EQUAL':
            case 'LESS_THAN':
            case 'LESS_THAN_OR_EQUAL':
                return true;
            default:
                return false;
        }
    }
    /**
     * Generates the proto representation for this field filter.
     *
     * @private
     */
    toProto() {
        if (typeof this.value === 'number' && isNaN(this.value)) {
            return {
                unaryFilter: {
                    field: {
                        fieldPath: this.field.formattedName,
                    },
                    op: 'IS_NAN',
                },
            };
        }
        if (this.value === null) {
            return {
                unaryFilter: {
                    field: {
                        fieldPath: this.field.formattedName,
                    },
                    op: 'IS_NULL',
                },
            };
        }
        return {
            fieldFilter: {
                field: {
                    fieldPath: this.field.formattedName,
                },
                op: this.op,
                value: this.serializer.encodeValue(this.value),
            },
        };
    }
}
/**
 * A QuerySnapshot contains zero or more
 * [QueryDocumentSnapshot]{@link QueryDocumentSnapshot} objects
 * representing the results of a query. The documents can be accessed as an
 * array via the [documents]{@link QuerySnapshot#documents} property
 * or enumerated using the [forEach]{@link QuerySnapshot#forEach}
 * method. The number of documents can be determined via the
 * [empty]{@link QuerySnapshot#empty} and
 * [size]{@link QuerySnapshot#size} properties.
 *
 * @class QuerySnapshot
 */
class QuerySnapshot {
    /**
     * @hideconstructor
     *
     * @param _query The originating query.
     * @param _readTime The time when this query snapshot was obtained.
     * @param _size The number of documents in the result set.
     * @param docs A callback returning a sorted array of documents matching
     * this query
     * @param changes A callback returning a sorted array of document change
     * events for this snapshot.
     */
    constructor(_query, _readTime, _size, docs, changes) {
        this._query = _query;
        this._readTime = _readTime;
        this._size = _size;
        this._materializedDocs = null;
        this._materializedChanges = null;
        this._docs = null;
        this._changes = null;
        this._docs = docs;
        this._changes = changes;
    }
    /**
     * The query on which you called get() or onSnapshot() in order to get this
     * QuerySnapshot.
     *
     * @type {Query}
     * @name QuerySnapshot#query
     * @readonly
     *
     * @example
     * let query = firestore.collection('col').where('foo', '==', 'bar');
     *
     * query.limit(10).get().then(querySnapshot => {
     *   console.log(`Returned first batch of results`);
     *   let query = querySnapshot.query;
     *   return query.offset(10).get();
     * }).then(() => {
     *   console.log(`Returned second batch of results`);
     * });
     */
    get query() {
        return this._query;
    }
    /**
     * An array of all the documents in this QuerySnapshot.
     *
     * @type {Array.<QueryDocumentSnapshot>}
     * @name QuerySnapshot#docs
     * @readonly
     *
     * @example
     * let query = firestore.collection('col').where('foo', '==', 'bar');
     *
     * query.get().then(querySnapshot => {
     *   let docs = querySnapshot.docs;
     *   for (let doc of docs) {
     *     console.log(`Document found at path: ${doc.ref.path}`);
     *   }
     * });
     */
    get docs() {
        if (this._materializedDocs) {
            return this._materializedDocs;
        }
        this._materializedDocs = this._docs();
        this._docs = null;
        return this._materializedDocs;
    }
    /**
     * True if there are no documents in the QuerySnapshot.
     *
     * @type {boolean}
     * @name QuerySnapshot#empty
     * @readonly
     *
     * @example
     * let query = firestore.collection('col').where('foo', '==', 'bar');
     *
     * query.get().then(querySnapshot => {
     *   if (querySnapshot.empty) {
     *     console.log('No documents found.');
     *   }
     * });
     */
    get empty() {
        return this._size === 0;
    }
    /**
     * The number of documents in the QuerySnapshot.
     *
     * @type {number}
     * @name QuerySnapshot#size
     * @readonly
     *
     * @example
     * let query = firestore.collection('col').where('foo', '==', 'bar');
     *
     * query.get().then(querySnapshot => {
     *   console.log(`Found ${querySnapshot.size} documents.`);
     * });
     */
    get size() {
        return this._size;
    }
    /**
     * The time this query snapshot was obtained.
     *
     * @type {Timestamp}
     * @name QuerySnapshot#readTime
     *
     * @example
     * let query = firestore.collection('col').where('foo', '==', 'bar');
     *
     * query.get().then((querySnapshot) => {
     *   let readTime = querySnapshot.readTime;
     *   console.log(`Query results returned at '${readTime.toDate()}'`);
     * });
     */
    get readTime() {
        return this._readTime;
    }
    /**
     * Returns an array of the documents changes since the last snapshot. If
     * this is the first snapshot, all documents will be in the list as added
     * changes.
     *
     * @return {Array.<DocumentChange>}
     *
     * @example
     * let query = firestore.collection('col').where('foo', '==', 'bar');
     *
     * query.onSnapshot(querySnapshot => {
     *   let changes = querySnapshot.docChanges();
     *   for (let change of changes) {
     *     console.log(`A document was ${change.type}.`);
     *   }
     * });
     */
    docChanges() {
        if (this._materializedChanges) {
            return this._materializedChanges;
        }
        this._materializedChanges = this._changes();
        this._changes = null;
        return this._materializedChanges;
    }
    /**
     * Enumerates all of the documents in the QuerySnapshot. This is a convenience
     * method for running the same callback on each {@link QueryDocumentSnapshot}
     * that is returned.
     *
     * @param {function} callback A callback to be called with a
     * [QueryDocumentSnapshot]{@link QueryDocumentSnapshot} for each document in
     * the snapshot.
     * @param {*=} thisArg The `this` binding for the callback..
     *
     * @example
     * let query = firestore.collection('col').where('foo', '==', 'bar');
     *
     * query.get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Document found at path: ${documentSnapshot.ref.path}`);
     *   });
     * });
     */
    forEach(callback, thisArg) {
        validate_1.validateFunction('callback', callback);
        for (const doc of this.docs) {
            callback.call(thisArg, doc);
        }
    }
    /**
     * Returns true if the document data in this `QuerySnapshot` is equal to the
     * provided value.
     *
     * @param {*} other The value to compare against.
     * @return {boolean} true if this `QuerySnapshot` is equal to the provided
     * value.
     */
    isEqual(other) {
        // Since the read time is different on every query read, we explicitly
        // ignore all metadata in this comparison.
        if (this === other) {
            return true;
        }
        if (!(other instanceof QuerySnapshot)) {
            return false;
        }
        if (this._size !== other._size) {
            return false;
        }
        if (!this._query.isEqual(other._query)) {
            return false;
        }
        if (this._materializedDocs && !this._materializedChanges) {
            // If we have only materialized the documents, we compare them first.
            return (isArrayEqual(this.docs, other.docs) &&
                isArrayEqual(this.docChanges(), other.docChanges()));
        }
        // Otherwise, we compare the changes first as we expect there to be fewer.
        return (isArrayEqual(this.docChanges(), other.docChanges()) &&
            isArrayEqual(this.docs, other.docs));
    }
}
exports.QuerySnapshot = QuerySnapshot;
// TODO: As of v0.17.0, we're changing docChanges from an array into a method.
// Because this is a runtime breaking change and somewhat subtle (both Array and
// Function have a .length, etc.), we'll replace commonly-used properties
// (including Symbol.iterator) to throw a custom error message. By our v1.0
// release, we should remove this code.
function throwDocChangesMethodError() {
    throw new Error('QuerySnapshot.docChanges has been changed from a property into a ' +
        'method, so usages like "querySnapshot.docChanges" should become ' +
        '"querySnapshot.docChanges()"');
}
const docChangesPropertiesToOverride = [
    'length',
    'forEach',
    'map',
    ...(typeof Symbol !== 'undefined' ? [Symbol.iterator] : []),
];
docChangesPropertiesToOverride.forEach(property => {
    Object.defineProperty(QuerySnapshot.prototype.docChanges, property, {
        get: () => throwDocChangesMethodError(),
    });
});
/**
 * Internal class representing custom Query options.
 *
 * These options are immutable. Modified options can be created using `with()`.
 * @private
 */
class QueryOptions {
    constructor(parentPath, collectionId, allDescendants, fieldFilters, fieldOrders, startAt, endAt, limit, offset, projection) {
        this.parentPath = parentPath;
        this.collectionId = collectionId;
        this.allDescendants = allDescendants;
        this.fieldFilters = fieldFilters;
        this.fieldOrders = fieldOrders;
        this.startAt = startAt;
        this.endAt = endAt;
        this.limit = limit;
        this.offset = offset;
        this.projection = projection;
    }
    /**
     * Returns query options for a collection group query.
     * @private
     */
    static forCollectionGroupQuery(collectionId) {
        return new QueryOptions(
        /*parentPath=*/ path_1.ResourcePath.EMPTY, collectionId, 
        /*allDescendants=*/ true, 
        /*fieldFilters=*/ [], 
        /*fieldOrders=*/ []);
    }
    /**
     * Returns query options for a single-collection query.
     * @private
     */
    static forCollectionQuery(collectionRef) {
        return new QueryOptions(collectionRef.parent(), collectionRef.id, 
        /*allDescendants=*/ false, 
        /*fieldFilters=*/ [], 
        /*fieldOrders=*/ []);
    }
    /**
     * Returns the union of the current and the provided options.
     * @private
     */
    with(settings) {
        return new QueryOptions(coalesce(settings.parentPath, this.parentPath), coalesce(settings.collectionId, this.collectionId), coalesce(settings.allDescendants, this.allDescendants), coalesce(settings.fieldFilters, this.fieldFilters), coalesce(settings.fieldOrders, this.fieldOrders), coalesce(settings.startAt, this.startAt), coalesce(settings.endAt, this.endAt), coalesce(settings.limit, this.limit), coalesce(settings.offset, this.offset), coalesce(settings.projection, this.projection));
    }
    isEqual(other) {
        if (this === other) {
            return true;
        }
        return (other instanceof QueryOptions &&
            this.parentPath.isEqual(other.parentPath) &&
            this.collectionId === other.collectionId &&
            this.allDescendants === other.allDescendants &&
            this.limit === other.limit &&
            this.offset === other.offset &&
            deepEqual(this.fieldFilters, other.fieldFilters, { strict: true }) &&
            deepEqual(this.fieldOrders, other.fieldOrders, { strict: true }) &&
            deepEqual(this.startAt, other.startAt, { strict: true }) &&
            deepEqual(this.endAt, other.endAt, { strict: true }) &&
            deepEqual(this.projection, other.projection, { strict: true }));
    }
}
exports.QueryOptions = QueryOptions;
/**
 * A Query refers to a query which you can read or stream from. You can also
 * construct refined Query objects by adding filters and ordering.
 *
 * @class Query
 */
class Query {
    /**
     * @hideconstructor
     *
     * @param _firestore The Firestore Database client.
     * @param _queryOptions Options that define the query.
     */
    constructor(_firestore, _queryOptions) {
        this._firestore = _firestore;
        this._queryOptions = _queryOptions;
        this._serializer = new serializer_1.Serializer(_firestore);
    }
    /**
     * Detects the argument type for Firestore cursors.
     *
     * @private
     * @param fieldValuesOrDocumentSnapshot A snapshot of the document or a set
     * of field values.
     * @returns 'true' if the input is a single DocumentSnapshot..
     */
    static _isDocumentSnapshot(fieldValuesOrDocumentSnapshot) {
        return (fieldValuesOrDocumentSnapshot.length === 1 &&
            fieldValuesOrDocumentSnapshot[0] instanceof document_1.DocumentSnapshot);
    }
    /**
     * Extracts field values from the DocumentSnapshot based on the provided
     * field order.
     *
     * @private
     * @param documentSnapshot The document to extract the fields from.
     * @param fieldOrders The field order that defines what fields we should
     * extract.
     * @return {Array.<*>} The field values to use.
     * @private
     */
    static _extractFieldValues(documentSnapshot, fieldOrders) {
        const fieldValues = [];
        for (const fieldOrder of fieldOrders) {
            if (path_1.FieldPath.documentId().isEqual(fieldOrder.field)) {
                fieldValues.push(documentSnapshot.ref);
            }
            else {
                const fieldValue = documentSnapshot.get(fieldOrder.field);
                if (fieldValue === undefined) {
                    throw new Error(`Field "${fieldOrder.field}" is missing in the provided DocumentSnapshot. ` +
                        'Please provide a document that contains values for all specified ' +
                        'orderBy() and where() constraints.');
                }
                else {
                    fieldValues.push(fieldValue);
                }
            }
        }
        return fieldValues;
    }
    /**
     * The [Firestore]{@link Firestore} instance for the Firestore
     * database (useful for performing transactions, etc.).
     *
     * @type {Firestore}
     * @name Query#firestore
     * @readonly
     *
     * @example
     * let collectionRef = firestore.collection('col');
     *
     * collectionRef.add({foo: 'bar'}).then(documentReference => {
     *   let firestore = documentReference.firestore;
     *   console.log(`Root location for document is ${firestore.formattedName}`);
     * });
     */
    get firestore() {
        return this._firestore;
    }
    /**
     * Creates and returns a new [Query]{@link Query} with the additional filter
     * that documents must contain the specified field and that its value should
     * satisfy the relation constraint provided.
     *
     * Returns a new Query that constrains the value of a Document property.
     *
     * This function returns a new (immutable) instance of the Query (rather than
     * modify the existing instance) to impose the filter.
     *
     * @param {string|FieldPath} fieldPath The name of a property value to compare.
     * @param {string} opStr A comparison operation in the form of a string
     * (e.g., "<").
     * @param {*} value The value to which to compare the field for inclusion in
     * a query.
     * @returns {Query} The created Query.
     *
     * @example
     * let collectionRef = firestore.collection('col');
     *
     * collectionRef.where('foo', '==', 'bar').get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Found document at ${documentSnapshot.ref.path}`);
     *   });
     * });
     */
    where(fieldPath, opStr, value) {
        path_1.validateFieldPath('fieldPath', fieldPath);
        opStr = validateQueryOperator('opStr', opStr, value);
        validateQueryValue('value', value);
        if (this._queryOptions.startAt || this._queryOptions.endAt) {
            throw new Error('Cannot specify a where() filter after calling startAt(), ' +
                'startAfter(), endBefore() or endAt().');
        }
        const path = path_1.FieldPath.fromArgument(fieldPath);
        if (path_1.FieldPath.documentId().isEqual(path)) {
            value = this.validateReference(value);
        }
        const fieldFilter = new FieldFilter(this._serializer, path, comparisonOperators[opStr], value);
        const options = this._queryOptions.with({
            fieldFilters: this._queryOptions.fieldFilters.concat(fieldFilter),
        });
        return new Query(this._firestore, options);
    }
    /**
     * Creates and returns a new [Query]{@link Query} instance that applies a
     * field mask to the result and returns only the specified subset of fields.
     * You can specify a list of field paths to return, or use an empty list to
     * only return the references of matching documents.
     *
     * This function returns a new (immutable) instance of the Query (rather than
     * modify the existing instance) to impose the field mask.
     *
     * @param {...(string|FieldPath)} fieldPaths The field paths to return.
     * @returns {Query} The created Query.
     *
     * @example
     * let collectionRef = firestore.collection('col');
     * let documentRef = collectionRef.doc('doc');
     *
     * return documentRef.set({x:10, y:5}).then(() => {
     *   return collectionRef.where('x', '>', 5).select('y').get();
     * }).then((res) => {
     *   console.log(`y is ${res.docs[0].get('y')}.`);
     * });
     */
    select(...fieldPaths) {
        const fields = [];
        if (fieldPaths.length === 0) {
            fields.push({ fieldPath: path_1.FieldPath.documentId().formattedName });
        }
        else {
            for (let i = 0; i < fieldPaths.length; ++i) {
                path_1.validateFieldPath(i, fieldPaths[i]);
                fields.push({
                    fieldPath: path_1.FieldPath.fromArgument(fieldPaths[i]).formattedName,
                });
            }
        }
        const options = this._queryOptions.with({ projection: { fields } });
        return new Query(this._firestore, options);
    }
    /**
     * Creates and returns a new [Query]{@link Query} that's additionally sorted
     * by the specified field, optionally in descending order instead of
     * ascending.
     *
     * This function returns a new (immutable) instance of the Query (rather than
     * modify the existing instance) to impose the field mask.
     *
     * @param {string|FieldPath} fieldPath The field to sort by.
     * @param {string=} directionStr Optional direction to sort by ('asc' or
     * 'desc'). If not specified, order will be ascending.
     * @returns {Query} The created Query.
     *
     * @example
     * let query = firestore.collection('col').where('foo', '>', 42);
     *
     * query.orderBy('foo', 'desc').get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Found document at ${documentSnapshot.ref.path}`);
     *   });
     * });
     */
    orderBy(fieldPath, directionStr) {
        path_1.validateFieldPath('fieldPath', fieldPath);
        directionStr = validateQueryOrder('directionStr', directionStr);
        if (this._queryOptions.startAt || this._queryOptions.endAt) {
            throw new Error('Cannot specify an orderBy() constraint after calling ' +
                'startAt(), startAfter(), endBefore() or endAt().');
        }
        const newOrder = new FieldOrder(path_1.FieldPath.fromArgument(fieldPath), directionOperators[directionStr || 'asc']);
        const options = this._queryOptions.with({
            fieldOrders: this._queryOptions.fieldOrders.concat(newOrder),
        });
        return new Query(this._firestore, options);
    }
    /**
     * Creates and returns a new [Query]{@link Query} that's additionally limited
     * to only return up to the specified number of documents.
     *
     * This function returns a new (immutable) instance of the Query (rather than
     * modify the existing instance) to impose the limit.
     *
     * @param {number} limit The maximum number of items to return.
     * @returns {Query} The created Query.
     *
     * @example
     * let query = firestore.collection('col').where('foo', '>', 42);
     *
     * query.limit(1).get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Found document at ${documentSnapshot.ref.path}`);
     *   });
     * });
     */
    limit(limit) {
        validate_1.validateInteger('limit', limit);
        const options = this._queryOptions.with({ limit });
        return new Query(this._firestore, options);
    }
    /**
     * Specifies the offset of the returned results.
     *
     * This function returns a new (immutable) instance of the
     * [Query]{@link Query} (rather than modify the existing instance)
     * to impose the offset.
     *
     * @param {number} offset The offset to apply to the Query results
     * @returns {Query} The created Query.
     *
     * @example
     * let query = firestore.collection('col').where('foo', '>', 42);
     *
     * query.limit(10).offset(20).get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Found document at ${documentSnapshot.ref.path}`);
     *   });
     * });
     */
    offset(offset) {
        validate_1.validateInteger('offset', offset);
        const options = this._queryOptions.with({ offset });
        return new Query(this._firestore, options);
    }
    /**
     * Returns true if this `Query` is equal to the provided value.
     *
     * @param {*} other The value to compare against.
     * @return {boolean} true if this `Query` is equal to the provided value.
     */
    isEqual(other) {
        if (this === other) {
            return true;
        }
        return (other instanceof Query && this._queryOptions.isEqual(other._queryOptions));
    }
    /**
     * Computes the backend ordering semantics for DocumentSnapshot cursors.
     *
     * @private
     * @param cursorValuesOrDocumentSnapshot The snapshot of the document or the
     * set of field values to use as the boundary.
     * @returns The implicit ordering semantics.
     */
    createImplicitOrderBy(cursorValuesOrDocumentSnapshot) {
        if (!Query._isDocumentSnapshot(cursorValuesOrDocumentSnapshot)) {
            return this._queryOptions.fieldOrders;
        }
        const fieldOrders = this._queryOptions.fieldOrders.slice();
        let hasDocumentId = false;
        if (fieldOrders.length === 0) {
            // If no explicit ordering is specified, use the first inequality to
            // define an implicit order.
            for (const fieldFilter of this._queryOptions.fieldFilters) {
                if (fieldFilter.isInequalityFilter()) {
                    fieldOrders.push(new FieldOrder(fieldFilter.field));
                    break;
                }
            }
        }
        else {
            for (const fieldOrder of fieldOrders) {
                if (path_1.FieldPath.documentId().isEqual(fieldOrder.field)) {
                    hasDocumentId = true;
                }
            }
        }
        if (!hasDocumentId) {
            // Add implicit sorting by name, using the last specified direction.
            const lastDirection = fieldOrders.length === 0
                ? directionOperators.ASC
                : fieldOrders[fieldOrders.length - 1].direction;
            fieldOrders.push(new FieldOrder(path_1.FieldPath.documentId(), lastDirection));
        }
        return fieldOrders;
    }
    /**
     * Builds a Firestore 'Position' proto message.
     *
     * @private
     * @param {Array.<FieldOrder>} fieldOrders The field orders to use for this
     * cursor.
     * @param {Array.<DocumentSnapshot|*>} cursorValuesOrDocumentSnapshot The
     * snapshot of the document or the set of field values to use as the boundary.
     * @param before Whether the query boundary lies just before or after the
     * provided data.
     * @returns {Object} The proto message.
     */
    createCursor(fieldOrders, cursorValuesOrDocumentSnapshot, before) {
        let fieldValues;
        if (Query._isDocumentSnapshot(cursorValuesOrDocumentSnapshot)) {
            fieldValues = Query._extractFieldValues(cursorValuesOrDocumentSnapshot[0], fieldOrders);
        }
        else {
            fieldValues = cursorValuesOrDocumentSnapshot;
        }
        if (fieldValues.length > fieldOrders.length) {
            throw new Error('Too many cursor values specified. The specified ' +
                'values must match the orderBy() constraints of the query.');
        }
        const options = { values: [] };
        if (before) {
            options.before = true;
        }
        for (let i = 0; i < fieldValues.length; ++i) {
            let fieldValue = fieldValues[i];
            if (path_1.FieldPath.documentId().isEqual(fieldOrders[i].field)) {
                fieldValue = this.validateReference(fieldValue);
            }
            validateQueryValue(i, fieldValue);
            options.values.push(fieldValue);
        }
        return options;
    }
    /**
     * Validates that a value used with FieldValue.documentId() is either a
     * string or a DocumentReference that is part of the query`s result set.
     * Throws a validation error or returns a DocumentReference that can
     * directly be used in the Query.
     *
     * @param val The value to validate.
     * @throws If the value cannot be used for this query.
     * @return If valid, returns a DocumentReference that can be used with the
     * query.
     * @private
     */
    validateReference(val) {
        const basePath = this._queryOptions.allDescendants
            ? this._queryOptions.parentPath
            : this._queryOptions.parentPath.append(this._queryOptions.collectionId);
        let reference;
        if (typeof val === 'string') {
            const path = basePath.append(val);
            if (this._queryOptions.allDescendants) {
                if (!path.isDocument) {
                    throw new Error('When querying a collection group and ordering by ' +
                        'FieldPath.documentId(), the corresponding value must result in ' +
                        `a valid document path, but '${val}' is not because it ` +
                        'contains an odd number of segments.');
                }
            }
            else if (val.indexOf('/') !== -1) {
                throw new Error('When querying a collection and ordering by FieldPath.documentId(), ' +
                    `the corresponding value must be a plain document ID, but '${val}' ` +
                    'contains a slash.');
            }
            reference = new DocumentReference(this._firestore, basePath.append(val));
        }
        else if (val instanceof DocumentReference) {
            reference = val;
            if (!basePath.isPrefixOf(reference._path)) {
                throw new Error(`"${reference.path}" is not part of the query result set and ` +
                    'cannot be used as a query boundary.');
            }
        }
        else {
            throw new Error('The corresponding value for FieldPath.documentId() must be a ' +
                'string or a DocumentReference.');
        }
        if (!this._queryOptions.allDescendants &&
            reference._path.parent().compareTo(basePath) !== 0) {
            throw new Error('Only a direct child can be used as a query boundary. ' +
                `Found: "${reference.path}".`);
        }
        return reference;
    }
    /**
     * Creates and returns a new [Query]{@link Query} that starts at the provided
     * set of field values relative to the order of the query. The order of the
     * provided values must match the order of the order by clauses of the query.
     *
     * @param {...*|DocumentSnapshot} fieldValuesOrDocumentSnapshot The snapshot
     * of the document the query results should start at or the field values to
     * start this query at, in order of the query's order by.
     * @returns {Query} A query with the new starting point.
     *
     * @example
     * let query = firestore.collection('col');
     *
     * query.orderBy('foo').startAt(42).get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Found document at ${documentSnapshot.ref.path}`);
     *   });
     * });
     */
    startAt(...fieldValuesOrDocumentSnapshot) {
        validate_1.validateMinNumberOfArguments('Query.startAt', arguments, 1);
        const fieldOrders = this.createImplicitOrderBy(fieldValuesOrDocumentSnapshot);
        const startAt = this.createCursor(fieldOrders, fieldValuesOrDocumentSnapshot, true);
        const options = this._queryOptions.with({ fieldOrders, startAt });
        return new Query(this._firestore, options);
    }
    /**
     * Creates and returns a new [Query]{@link Query} that starts after the
     * provided set of field values relative to the order of the query. The order
     * of the provided values must match the order of the order by clauses of the
     * query.
     *
     * @param {...*|DocumentSnapshot} fieldValuesOrDocumentSnapshot The snapshot
     * of the document the query results should start after or the field values to
     * start this query after, in order of the query's order by.
     * @returns {Query} A query with the new starting point.
     *
     * @example
     * let query = firestore.collection('col');
     *
     * query.orderBy('foo').startAfter(42).get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Found document at ${documentSnapshot.ref.path}`);
     *   });
     * });
     */
    startAfter(...fieldValuesOrDocumentSnapshot) {
        validate_1.validateMinNumberOfArguments('Query.startAfter', arguments, 1);
        const fieldOrders = this.createImplicitOrderBy(fieldValuesOrDocumentSnapshot);
        const startAt = this.createCursor(fieldOrders, fieldValuesOrDocumentSnapshot, false);
        const options = this._queryOptions.with({ fieldOrders, startAt });
        return new Query(this._firestore, options);
    }
    /**
     * Creates and returns a new [Query]{@link Query} that ends before the set of
     * field values relative to the order of the query. The order of the provided
     * values must match the order of the order by clauses of the query.
     *
     * @param {...*|DocumentSnapshot} fieldValuesOrDocumentSnapshot The snapshot
     * of the document the query results should end before or the field values to
     * end this query before, in order of the query's order by.
     * @returns {Query} A query with the new ending point.
     *
     * @example
     * let query = firestore.collection('col');
     *
     * query.orderBy('foo').endBefore(42).get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Found document at ${documentSnapshot.ref.path}`);
     *   });
     * });
     */
    endBefore(...fieldValuesOrDocumentSnapshot) {
        validate_1.validateMinNumberOfArguments('Query.endBefore', arguments, 1);
        const fieldOrders = this.createImplicitOrderBy(fieldValuesOrDocumentSnapshot);
        const endAt = this.createCursor(fieldOrders, fieldValuesOrDocumentSnapshot, true);
        const options = this._queryOptions.with({ fieldOrders, endAt });
        return new Query(this._firestore, options);
    }
    /**
     * Creates and returns a new [Query]{@link Query} that ends at the provided
     * set of field values relative to the order of the query. The order of the
     * provided values must match the order of the order by clauses of the query.
     *
     * @param {...*|DocumentSnapshot} fieldValuesOrDocumentSnapshot The snapshot
     * of the document the query results should end at or the field values to end
     * this query at, in order of the query's order by.
     * @returns {Query} A query with the new ending point.
     *
     * @example
     * let query = firestore.collection('col');
     *
     * query.orderBy('foo').endAt(42).get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Found document at ${documentSnapshot.ref.path}`);
     *   });
     * });
     */
    endAt(...fieldValuesOrDocumentSnapshot) {
        validate_1.validateMinNumberOfArguments('Query.endAt', arguments, 1);
        const fieldOrders = this.createImplicitOrderBy(fieldValuesOrDocumentSnapshot);
        const endAt = this.createCursor(fieldOrders, fieldValuesOrDocumentSnapshot, false);
        const options = this._queryOptions.with({ fieldOrders, endAt });
        return new Query(this._firestore, options);
    }
    /**
     * Executes the query and returns the results as a
     * [QuerySnapshot]{@link QuerySnapshot}.
     *
     * @returns {Promise.<QuerySnapshot>} A Promise that resolves with the results
     * of the Query.
     *
     * @example
     * let query = firestore.collection('col').where('foo', '==', 'bar');
     *
     * query.get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Found document at ${documentSnapshot.ref.path}`);
     *   });
     * });
     */
    get() {
        return this._get();
    }
    /**
     * Internal get() method that accepts an optional transaction id.
     *
     * @private
     * @param {bytes=} transactionId A transaction ID.
     */
    _get(transactionId) {
        const self = this;
        const docs = [];
        return new Promise((resolve, reject) => {
            let readTime;
            self
                ._stream(transactionId)
                .on('error', err => {
                reject(err);
            })
                .on('data', result => {
                readTime = result.readTime;
                if (result.document) {
                    const document = result.document;
                    docs.push(document);
                }
            })
                .on('end', () => {
                resolve(new QuerySnapshot(this, readTime, docs.length, () => docs, () => {
                    const changes = [];
                    for (let i = 0; i < docs.length; ++i) {
                        changes.push(new document_change_1.DocumentChange('added', docs[i], -1, i));
                    }
                    return changes;
                }));
            });
        });
    }
    /**
     * Executes the query and streams the results as
     * [QueryDocumentSnapshots]{@link QueryDocumentSnapshot}.
     *
     * @returns {Stream.<QueryDocumentSnapshot>} A stream of
     * QueryDocumentSnapshots.
     *
     * @example
     * let query = firestore.collection('col').where('foo', '==', 'bar');
     *
     * let count = 0;
     *
     * query.stream().on('data', (documentSnapshot) => {
     *   console.log(`Found document with name '${documentSnapshot.id}'`);
     *   ++count;
     * }).on('end', () => {
     *   console.log(`Total count is ${count}`);
     * });
     */
    stream() {
        const responseStream = this._stream();
        const transform = through2.obj(function (chunk, encoding, callback) {
            // Only send chunks with documents.
            if (chunk.document) {
                this.push(chunk.document);
            }
            callback();
        });
        return bun([responseStream, transform]);
    }
    /**
     * Converts a QueryCursor to its proto representation.
     * @private
     */
    _toCursor(cursor) {
        if (cursor) {
            const values = cursor.values.map(val => this._serializer.encodeValue(val));
            return { before: cursor.before, values };
        }
        return undefined;
    }
    /**
     * Internal method for serializing a query to its RunQuery proto
     * representation with an optional transaction id.
     *
     * @param transactionId A transaction ID.
     * @private
     * @returns Serialized JSON for the query.
     */
    toProto(transactionId) {
        const projectId = this.firestore.projectId;
        const parentPath = this._queryOptions.parentPath.toQualifiedResourcePath(projectId);
        const reqOpts = {
            parent: parentPath.formattedName,
            structuredQuery: {
                from: [
                    {
                        collectionId: this._queryOptions.collectionId,
                    },
                ],
            },
        };
        if (this._queryOptions.allDescendants) {
            reqOpts.structuredQuery.from[0].allDescendants = true;
        }
        const structuredQuery = reqOpts.structuredQuery;
        if (this._queryOptions.fieldFilters.length === 1) {
            structuredQuery.where = this._queryOptions.fieldFilters[0].toProto();
        }
        else if (this._queryOptions.fieldFilters.length > 1) {
            const filters = [];
            for (const fieldFilter of this._queryOptions.fieldFilters) {
                filters.push(fieldFilter.toProto());
            }
            structuredQuery.where = {
                compositeFilter: {
                    op: 'AND',
                    filters,
                },
            };
        }
        if (this._queryOptions.fieldOrders.length) {
            const orderBy = [];
            for (const fieldOrder of this._queryOptions.fieldOrders) {
                orderBy.push(fieldOrder.toProto());
            }
            structuredQuery.orderBy = orderBy;
        }
        if (this._queryOptions.limit) {
            structuredQuery.limit = { value: this._queryOptions.limit };
        }
        structuredQuery.offset = this._queryOptions.offset;
        structuredQuery.startAt = this._toCursor(this._queryOptions.startAt);
        structuredQuery.endAt = this._toCursor(this._queryOptions.endAt);
        structuredQuery.select = this._queryOptions.projection;
        reqOpts.transaction = transactionId;
        return reqOpts;
    }
    /**
     * Internal streaming method that accepts an optional transaction id.
     *
     * @param transactionId A transaction ID.
     * @private
     * @returns A stream of document results.
     */
    _stream(transactionId) {
        const tag = util_1.requestTag();
        const self = this;
        const stream = through2.obj(function (proto, enc, callback) {
            const readTime = timestamp_1.Timestamp.fromProto(proto.readTime);
            if (proto.document) {
                const document = self.firestore.snapshot_(proto.document, proto.readTime);
                this.push({ document, readTime });
            }
            else {
                this.push({ readTime });
            }
            callback();
        });
        this.firestore.initializeIfNeeded(tag).then(() => {
            const request = this.toProto(transactionId);
            this._firestore
                .readStream('runQuery', request, tag, true)
                .then(backendStream => {
                backendStream.on('error', err => {
                    logger_1.logger('Query._stream', tag, 'Query failed with stream error:', err);
                    stream.destroy(err);
                });
                backendStream.resume();
                backendStream.pipe(stream);
            })
                .catch(err => {
                stream.destroy(err);
            });
        });
        return stream;
    }
    /**
     * Attaches a listener for QuerySnapshot events.
     *
     * @param {querySnapshotCallback} onNext A callback to be called every time
     * a new [QuerySnapshot]{@link QuerySnapshot} is available.
     * @param {errorCallback=} onError A callback to be called if the listen
     * fails or is cancelled. No further callbacks will occur.
     *
     * @returns {function()} An unsubscribe function that can be called to cancel
     * the snapshot listener.
     *
     * @example
     * let query = firestore.collection('col').where('foo', '==', 'bar');
     *
     * let unsubscribe = query.onSnapshot(querySnapshot => {
     *   console.log(`Received query snapshot of size ${querySnapshot.size}`);
     * }, err => {
     *   console.log(`Encountered error: ${err}`);
     * });
     *
     * // Remove this listener.
     * unsubscribe();
     */
    onSnapshot(onNext, onError) {
        validate_1.validateFunction('onNext', onNext);
        validate_1.validateFunction('onError', onError, { optional: true });
        const watch = new watch_1.QueryWatch(this.firestore, this);
        return watch.onSnapshot((readTime, size, docs, changes) => {
            onNext(new QuerySnapshot(this, readTime, size, docs, changes));
        }, onError || console.error);
    }
    /**
     * Returns a function that can be used to sort QueryDocumentSnapshots
     * according to the sort criteria of this query.
     *
     * @private
     */
    comparator() {
        return (doc1, doc2) => {
            // Add implicit sorting by name, using the last specified direction.
            const lastDirection = this._queryOptions.fieldOrders.length === 0
                ? 'ASCENDING'
                : this._queryOptions.fieldOrders[this._queryOptions.fieldOrders.length - 1].direction;
            const orderBys = this._queryOptions.fieldOrders.concat(new FieldOrder(path_1.FieldPath.documentId(), lastDirection));
            for (const orderBy of orderBys) {
                let comp;
                if (path_1.FieldPath.documentId().isEqual(orderBy.field)) {
                    comp = doc1.ref._path.compareTo(doc2.ref._path);
                }
                else {
                    const v1 = doc1.protoField(orderBy.field);
                    const v2 = doc2.protoField(orderBy.field);
                    if (v1 === undefined || v2 === undefined) {
                        throw new Error('Trying to compare documents on fields that ' +
                            "don't exist. Please include the fields you are ordering on " +
                            'in your select() call.');
                    }
                    comp = order_1.compare(v1, v2);
                }
                if (comp !== 0) {
                    const direction = orderBy.direction === 'ASCENDING' ? 1 : -1;
                    return direction * comp;
                }
            }
            return 0;
        };
    }
}
exports.Query = Query;
/**
 * A CollectionReference object can be used for adding documents, getting
 * document references, and querying for documents (using the methods
 * inherited from [Query]{@link Query}).
 *
 * @class
 * @extends Query
 */
class CollectionReference extends Query {
    /**
     * @hideconstructor
     *
     * @param firestore The Firestore Database client.
     * @param path The Path of this collection.
     */
    constructor(firestore, path) {
        super(firestore, QueryOptions.forCollectionQuery(path));
    }
    /**
     * Returns a resource path for this collection.
     * @private
     */
    get resourcePath() {
        return this._queryOptions.parentPath.append(this._queryOptions.collectionId);
    }
    /**
     * The last path element of the referenced collection.
     *
     * @type {string}
     * @name CollectionReference#id
     * @readonly
     *
     * @example
     * let collectionRef = firestore.collection('col/doc/subcollection');
     * console.log(`ID of the subcollection: ${collectionRef.id}`);
     */
    get id() {
        return this._queryOptions.collectionId;
    }
    /**
     * A reference to the containing Document if this is a subcollection, else
     * null.
     *
     * @type {DocumentReference}
     * @name CollectionReference#parent
     * @readonly
     *
     * @example
     * let collectionRef = firestore.collection('col/doc/subcollection');
     * let documentRef = collectionRef.parent;
     * console.log(`Parent name: ${documentRef.path}`);
     */
    get parent() {
        return new DocumentReference(this.firestore, this._queryOptions.parentPath);
    }
    /**
     * A string representing the path of the referenced collection (relative
     * to the root of the database).
     *
     * @type {string}
     * @name CollectionReference#path
     * @readonly
     *
     * @example
     * let collectionRef = firestore.collection('col/doc/subcollection');
     * console.log(`Path of the subcollection: ${collectionRef.path}`);
     */
    get path() {
        return this.resourcePath.relativeName;
    }
    /**
     * Retrieves the list of documents in this collection.
     *
     * The document references returned may include references to "missing
     * documents", i.e. document locations that have no document present but
     * which contain subcollections with documents. Attempting to read such a
     * document reference (e.g. via `.get()` or `.onSnapshot()`) will return a
     * `DocumentSnapshot` whose `.exists` property is false.
     *
     * @return {Promise<DocumentReference[]>} The list of documents in this
     * collection.
     *
     * @example
     * let collectionRef = firestore.collection('col');
     *
     * return collectionRef.listDocuments().then(documentRefs => {
     *    return firestore.getAll(documentRefs);
     * }).then(documentSnapshots => {
     *    for (let documentSnapshot of documentSnapshots) {
     *       if (documentSnapshot.exists) {
     *         console.log(`Found document with data: ${documentSnapshot.id}`);
     *       } else {
     *         console.log(`Found missing document: ${documentSnapshot.id}`);
     *       }
     *    }
     * });
     */
    listDocuments() {
        const tag = util_1.requestTag();
        return this.firestore.initializeIfNeeded(tag).then(() => {
            const parentPath = this._queryOptions.parentPath.toQualifiedResourcePath(this.firestore.projectId);
            const request = {
                parent: parentPath.formattedName,
                collectionId: this.id,
                showMissing: true,
                mask: { fieldPaths: [] },
            };
            return this.firestore
                .request('listDocuments', request, tag, 
            /*allowRetries=*/ true)
                .then(documents => {
                // Note that the backend already orders these documents by name,
                // so we do not need to manually sort them.
                return documents.map(doc => {
                    const path = path_1.QualifiedResourcePath.fromSlashSeparatedString(doc.name);
                    return this.doc(path.id);
                });
            });
        });
    }
    /**
     * Gets a [DocumentReference]{@link DocumentReference} instance that
     * refers to the document at the specified path. If no path is specified, an
     * automatically-generated unique ID will be used for the returned
     * DocumentReference.
     *
     * @param {string=} documentPath A slash-separated path to a document.
     * @returns {DocumentReference} The `DocumentReference`
     * instance.
     *
     * @example
     * let collectionRef = firestore.collection('col');
     * let documentRefWithName = collectionRef.doc('doc');
     * let documentRefWithAutoId = collectionRef.doc();
     * console.log(`Reference with name: ${documentRefWithName.path}`);
     * console.log(`Reference with auto-id: ${documentRefWithAutoId.path}`);
     */
    doc(documentPath) {
        if (arguments.length === 0) {
            documentPath = util_1.autoId();
        }
        else {
            path_1.validateResourcePath('documentPath', documentPath);
        }
        const path = this.resourcePath.append(documentPath);
        if (!path.isDocument) {
            throw new Error(`Value for argument "documentPath" must point to a document, but was "${documentPath}". Your path does not contain an even number of components.`);
        }
        return new DocumentReference(this.firestore, path);
    }
    /**
     * Add a new document to this collection with the specified data, assigning
     * it a document ID automatically.
     *
     * @param {DocumentData} data An Object containing the data for the new
     * document.
     * @returns {Promise.<DocumentReference>} A Promise resolved with a
     * [DocumentReference]{@link DocumentReference} pointing to the
     * newly created document.
     *
     * @example
     * let collectionRef = firestore.collection('col');
     * collectionRef.add({foo: 'bar'}).then(documentReference => {
     *   console.log(`Added document with name: ${documentReference.id}`);
     * });
     */
    add(data) {
        write_batch_1.validateDocumentData('data', data, /*allowDeletes=*/ false);
        const documentRef = this.doc();
        return documentRef.create(data).then(() => documentRef);
    }
    /**
     * Returns true if this `CollectionReference` is equal to the provided value.
     *
     * @param {*} other The value to compare against.
     * @return {boolean} true if this `CollectionReference` is equal to the
     * provided value.
     */
    isEqual(other) {
        return (this === other ||
            (other instanceof CollectionReference && super.isEqual(other)));
    }
}
exports.CollectionReference = CollectionReference;
/**
 * Validates the input string as a field order direction.
 *
 * @private
 * @param arg The argument name or argument index (for varargs methods).
 * @param op Order direction to validate.
 * @throws when the direction is invalid
 * @return a validated input value, which may be different from the provided
 * value.
 */
function validateQueryOrder(arg, op) {
    // For backwards compatibility, we support both lower and uppercase values.
    op = typeof op === 'string' ? op.toLowerCase() : op;
    validate_1.validateEnumValue(arg, op, Object.keys(directionOperators), { optional: true });
    return op;
}
exports.validateQueryOrder = validateQueryOrder;
/**
 * Validates the input string as a field comparison operator.
 *
 * @private
 * @param arg The argument name or argument index (for varargs methods).
 * @param op Field comparison operator to validate.
 * @param fieldValue Value that is used in the filter.
 * @throws when the comparison operation is invalid
 * @return a validated input value, which may be different from the provided
 * value.
 */
function validateQueryOperator(arg, op, fieldValue) {
    // For backwards compatibility, we support both `=` and `==` for "equals".
    op = op === '=' ? '==' : op;
    validate_1.validateEnumValue(arg, op, Object.keys(comparisonOperators));
    if (typeof fieldValue === 'number' && isNaN(fieldValue) && op !== '==') {
        throw new Error('Invalid query. You can only perform equals comparisons on NaN.');
    }
    if (fieldValue === null && op !== '==') {
        throw new Error('Invalid query. You can only perform equals comparisons on Null.');
    }
    return op;
}
exports.validateQueryOperator = validateQueryOperator;
/**
 * Validates that 'value' is a DocumentReference.
 *
 * @private
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The argument to validate.
 */
function validateDocumentReference(arg, value) {
    if (!(value instanceof DocumentReference)) {
        throw new Error(validate_1.invalidArgumentMessage(arg, 'DocumentReference'));
    }
}
exports.validateDocumentReference = validateDocumentReference;
/**
 * Validates that 'value' can be used as a query value.
 *
 * @private
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The argument to validate.
 */
function validateQueryValue(arg, value) {
    serializer_1.validateUserInput(arg, value, 'query constraint', {
        allowDeletes: 'none',
        allowTransforms: false,
    });
}
/**
 * Verifies equality for an array of objects using the `isEqual` interface.
 *
 * @private
 * @param left Array of objects supporting `isEqual`.
 * @param right Array of objects supporting `isEqual`.
 * @return True if arrays are equal.
 */
function isArrayEqual(left, right) {
    if (left.length !== right.length) {
        return false;
    }
    for (let i = 0; i < left.length; ++i) {
        if (!left[i].isEqual(right[i])) {
            return false;
        }
    }
    return true;
}
/**
 * Returns the first non-undefined value or `undefined` if no such value exists.
 * @private
 */
function coalesce(...values) {
    return values.find(value => value !== undefined);
}
//# sourceMappingURL=reference.js.map