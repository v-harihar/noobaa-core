'use strict';

const P = require('../../util/promise');
// const config = require('../../../config');
const md_store = require('../object_services/md_store');
const mongodb = require('mongodb');
const _ = require('lodash');
const dbg = require('../../util/debug_module')(__filename);
const system_store = require('../system_services/system_store').get_instance();
// const size_utils = require('../util/size_utils');
// const mongo_functions = require('../../util/mongo_functions');

// TODO: This method is based on a single system
function background_worker() {
    if (!system_store.is_finished_initial_load) {
        dbg.log0('System did not finish initial load');
        return;
    }
    // First bucket always exists and always will have the earliest update time
    var first_bucket = system_store.data.buckets[0];
    if (!first_bucket) {
        dbg.log0('There are no buckets to fetch');
        return;
    }
    // var last_update = first_bucket.storage_stats && new Date(first_bucket.storage_stats.last_update);
    // var params = {
    //     from_date: last_update || (new Date(0)),
    //     till_date: new Date()
    // };
    var last_update = (first_bucket.storage_stats && first_bucket.storage_stats.last_update) || 0;
    // var current_date = (last_update < 0) ? new Date(Math.abs(last_update)) : new Date();
    var params = {
        from_date: new Date(last_update),
        till_date: new Date()
        // from_date: new Date(Math.max(last_update, 0)),
        // till_date: current_date
    };

    // TODO: This can only happen if the time was adjusted by NTP or manually
    // We initilize the calculations and gather them once again
    // Notice: This is eventually consistent which means that when you upload
    // in the future and roll back the time to the past, you won't see the changes
    // untill you reach the future time.
    // This should be changed and is an open issue
    if (params.till_date < params.from_date) {
        console.error('Time has been changed, initilized all bucket storage calculations');
        return P.resolve(system_store.make_changes({
                update: {
                    buckets: _.map(system_store.data.buckets, bucket => ({
                        _id: bucket._id,
                        storage_stats: {
                            chunks_capacity: 0,
                            objects_size: 0,
                            objects_count: 0,
                            // TODO: Assigning Epoch so we will gather all data till the new time
                            last_update: 0
                            // TODO: This is a hack in order to know where we were before the time change
                            // The hack did not work, we updated immediately the correct values, but afterwards
                            // when we've reached the time that they were created at (in the future), we added them again.
                            // This is why we are eventually consistent, and the values will appear in the future, and not immediately.
                            // last_update: -(params.from_date.getTime() + config.BUCKET_FETCH_INTERVAL)
                        },
                    }))
                }
            }))
            .return();
    }
    let hex_from_date = Math.floor(params.from_date.getTime() / 1000).toString(16);
    let hex_till_date = Math.floor(params.till_date.getTime() / 1000).toString(16);

    // ObjectId consists of 24 hex string so we allign to that
    params.from_date_object = new mongodb.ObjectId(hex_from_date + "0".repeat(24 - hex_from_date.length));
    params.till_date_object = new mongodb.ObjectId(hex_till_date + "0".repeat(24 - hex_till_date.length));

    let existing_query = {
        $and: [{
            _id: {
                $gte: params.from_date_object,
            },
        }, {
            _id: {
                $lt: params.till_date_object,
            },
        }]
    };
    let deleted_query = {
        $and: [{
            deleted: {
                $gte: params.from_date,
            }
        }, {
            deleted: {
                $lt: params.till_date,
            }
        }]
    };

    return P.join(
            md_store.aggregate_chunks(existing_query),
            md_store.aggregate_chunks(deleted_query),
            md_store.aggregate_objects(existing_query),
            md_store.aggregate_objects(deleted_query)
        ).spread(function(
            existing_chunks_aggregate,
            deleted_chunks_aggregate,
            existing_objects_aggregate,
            deleted_objects_aggregate) {
            let bucket_updates = _.map(system_store.data.buckets, bucket => {
                let new_storage_stats = {
                    chunks_capacity: (bucket.storage_stats && bucket.storage_stats.chunks_capacity) || 0,
                    objects_size: (bucket.storage_stats && bucket.storage_stats.objects_size) || 0,
                    objects_count: (bucket.storage_stats && bucket.storage_stats.objects_count) || 0,
                    last_update: params.till_date.getTime(),
                };
                dbg.log0('Bucket storage stats before deltas:', new_storage_stats);
                // TODO: Convert to using bigint
                let delta_chunk_compress_size = ((existing_chunks_aggregate[bucket._id] && existing_chunks_aggregate[bucket._id].compress_size) || 0) -
                    ((deleted_chunks_aggregate[bucket._id] && deleted_chunks_aggregate[bucket._id].compress_size) || 0);
                let delta_object_size = ((existing_objects_aggregate[bucket._id] && existing_objects_aggregate[bucket._id].size) || 0) -
                    ((deleted_objects_aggregate[bucket._id] && deleted_objects_aggregate[bucket._id].size) || 0);
                let delta_object_count = ((existing_objects_aggregate[bucket._id] && existing_objects_aggregate[bucket._id].count) || 0) -
                    ((deleted_objects_aggregate[bucket._id] && deleted_objects_aggregate[bucket._id].count) || 0);
                // If we won't always update the checkpoint, on no changes
                // We will reduce all of the chunks from last checkpoint (which can be a lot)
                new_storage_stats.chunks_capacity += delta_chunk_compress_size;
                new_storage_stats.objects_size += delta_object_size;
                new_storage_stats.objects_count += delta_object_count;
                dbg.log0('Bucket storage stats after deltas:', new_storage_stats);
                return {
                    _id: bucket._id,
                    storage_stats: new_storage_stats
                };
            });
            return system_store.make_changes({
                update: {
                    buckets: bucket_updates
                }
            });
        })
        .catch(err => {
            dbg.log0('BUCKET STORAGE FETCH:', 'ERROR', err, err.stack);
        })
        .return();
}


// EXPORTS
exports.background_worker = background_worker;
