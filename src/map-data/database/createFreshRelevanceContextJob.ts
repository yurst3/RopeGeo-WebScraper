import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { PageDataSource } from 'ropegeo-common/models';
import tryEnqueueRelevanceJob from '../sqs/tryEnqueueRelevanceJob';

export type RelevanceContextJobRow = s.MapDataRelevantContextJob.JSONSelectable;

export type CreateFreshRelevanceContextJobParams = {
    mapDataId: string;
    pageId: string;
    pageSource?: PageDataSource;
};

/**
 * Deletes any existing job for the page (minting a new id), inserts a ready job, and enqueues.
 * A new job id is required so FIFO dedup and legend-item checkpoints do not skip a full recompute.
 */
const createFreshRelevanceContextJob = async (
    conn: db.Queryable,
    params: CreateFreshRelevanceContextJobParams,
): Promise<RelevanceContextJobRow> => {
    const pageSource = params.pageSource ?? PageDataSource.Ropewiki;
    const now = new Date();

    await db.deletes('MapDataRelevantContextJob', { pageId: params.pageId }).run(conn);

    const row = await db
        .insert('MapDataRelevantContextJob', {
            mapDataId: params.mapDataId,
            pageId: params.pageId,
            pageSource,
            pageReady: true,
            errorMessage: null,
            updatedAt: now,
        })
        .run(conn);

    await tryEnqueueRelevanceJob(row);
    return row;
};

export default createFreshRelevanceContextJob;
