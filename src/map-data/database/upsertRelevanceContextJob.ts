import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { PageDataSource } from 'ropegeo-common/models';
import tryEnqueueRelevanceJob from '../sqs/tryEnqueueRelevanceJob';

export type MapSideRelevanceJobParams = {
    mapDataId: string;
    pageId: string;
    pageSource: PageDataSource;
};

export type RelevanceContextJobRow = s.MapDataRelevantContextJob.JSONSelectable;

const upsertRelevanceContextJobFromMap = async (
    conn: db.Queryable,
    params: MapSideRelevanceJobParams,
): Promise<RelevanceContextJobRow> => {
    const now = new Date();
    await db
        .upsert(
            'MapDataRelevantContextJob',
            {
                mapDataId: params.mapDataId,
                pageId: params.pageId,
                pageSource: params.pageSource,
                pageReady: false,
                errors: null,
                updatedAt: now,
            },
            'pageId',
            {
                updateColumns: ['mapDataId', 'pageSource', 'errors', 'updatedAt'],
            },
        )
        .run(conn);

    const row = await db.selectOne('MapDataRelevantContextJob', { pageId: params.pageId }).run(conn);
    if (row == null) {
        throw new Error('upsertRelevanceContextJobFromMap: row missing after upsert');
    }

    await tryEnqueueRelevanceJob(row);
    return row;
};

const upsertRelevanceContextJobFromPage = async (
    conn: db.Queryable,
    pageId: string,
): Promise<RelevanceContextJobRow> => {
    const now = new Date();
    await db
        .upsert(
            'MapDataRelevantContextJob',
            {
                pageId,
                pageSource: PageDataSource.Ropewiki,
                pageReady: true,
                errors: null,
                updatedAt: now,
            },
            'pageId',
            {
                updateColumns: ['pageSource', 'pageReady', 'errors', 'updatedAt'],
            },
        )
        .run(conn);

    const row = await db.selectOne('MapDataRelevantContextJob', { pageId }).run(conn);
    if (row == null) {
        throw new Error('upsertRelevanceContextJobFromPage: row missing after upsert');
    }

    await tryEnqueueRelevanceJob(row);
    return row;
};

/** Map-data processor entry: records mapDataId for a page and enqueues when both sides are ready. */
const upsertRelevanceContextJob = async (
    conn: db.Queryable,
    params: MapSideRelevanceJobParams,
): Promise<void> => {
    await upsertRelevanceContextJobFromMap(conn, params);
};

export {
    upsertRelevanceContextJob,
    upsertRelevanceContextJobFromMap,
    upsertRelevanceContextJobFromPage,
};
