/* Copyright (C) 2016 NooBaa */

import { createReducer } from 'utils/reducer-utils';
import { flatMap, isDefined } from 'utils/core-utils';
import {
    FETCH_OBJECT_PARTS,
    COMPLETE_FETCH_OBJECT_PARTS,
    FAIL_FETCH_OBJECT_PARTS
} from 'action-types';

// ------------------------------
// Initial State
// ------------------------------
const initialState = {
    fetching: false,
    error: false,
    query: undefined,
    items: undefined
};

// ------------------------------
// Action Handlers
// ------------------------------

// An example of an action handler
function onFetchObjectParts(state, { payload }) {
    const items = _queryMatch(state.query || {}, payload) ?
        state.items :
        undefined;

    return {
        ...state,
        fetching: true,
        error: false,
        query: payload,
        items: items
    };
}

function onCompleteFetchObjectParts(state, { payload }) {
    const { query, parts } = payload;
    if (!_queryMatch(state.query, query)) {
        return state;
    }

    return {
        ...state,
        fetching: false,
        error: false,
        items: parts.map(_mapPart)
    };
}

function onFailFetchObjectParts(state, { payload }) {
    if (!_queryMatch(state.query, payload.query)) {
        return state;
    }

    return {
        ...state,
        fetching: false,
        error: true
    };
}

// ------------------------------
// Local util functions
// ------------------------------
function _queryMatch(q1, q2) {
    return true &&
        q1.bucket === q2.bucket &&
        q1.key === q2.key &&
        q1.limit === q2.limit &&
        q1.skip  === q2.skip;
}

function _mapPart(part) {
    const { chunk_coder_config: config } = part.chunk;
    const mode = part.chunk.adminfo.health.toUpperCase();
    const resiliency = config.parity_frags > 0 ? 'ERASURE_CODING' : 'REPLICATION';
    return {
        seq: part.seq,
        size: part.end - part.start,
        mode: mode,
        blocks: _mapPartBlocks(part, resiliency)
    };
}


function _mapPartBlocks(part, resiliency) {
    const { chunk } = part;
    return flatMap(chunk.frags, frag => {
        const [kind, seq] = _getBlockKindAndSeq(resiliency, frag);
        return frag.blocks
            .map(block => {
                const mode = block.adminfo.accessible ? 'HEALTHY' : 'NOT_ACCESSIBLE';
                const storage = _mapBlockStorage(block);
                const mirrorSet = block.adminfo.mirror_group;
                return { mode, kind, seq, mirrorSet, storage  };
            });
    });
}

function _getBlockKindAndSeq(resiliency, frag) {
    if (resiliency === 'REPLICATION') {
        return ['REPLICA'];
    }

    if (isDefined(frag.parity_index)) {
        return ['PARITY', frag.parity_index];
    }

    return ['DATA', frag.data_index];
}

function _mapBlockStorage(block) {
    const {
        in_cloud_pool,
        in_mongo_pool,
        pool_name,
        node_name
    } = block.adminfo;

    if (in_mongo_pool) {
        return { kind: 'INTERNAL' };

    } else if (in_cloud_pool) {
        return {
            kind: 'CLOUD',
            resource: pool_name
        };
    } else {
        return {
            kind: 'HOSTS',
            pool: pool_name,
            host: node_name
        };
    }
}

// ------------------------------
// Exported reducer function
// ------------------------------
export default createReducer(initialState, {
    [FETCH_OBJECT_PARTS]: onFetchObjectParts,
    [COMPLETE_FETCH_OBJECT_PARTS]: onCompleteFetchObjectParts,
    [FAIL_FETCH_OBJECT_PARTS]: onFailFetchObjectParts
});