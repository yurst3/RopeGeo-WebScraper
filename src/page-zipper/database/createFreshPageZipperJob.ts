import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { PageDataSource } from 'ropegeo-common/models';
import tryEnqueuePageZipperJob from '../sqs/tryEnqueuePageZipperJob';
import PageZipperJob, { type ReadinessRecord } from '../types/pageZipperJob';

export type { ReadinessRecord };
export { PageZipperJob };

export type CreateFreshPageZipperJobParams = {
    pageId: string;
    pageSource?: PageDataSource;
    pageReady?: boolean;
    mapDataId?: string | null;
    pageHasMapData?: boolean;
    mapDataLegendItemsReady?: ReadinessRecord | null;
    imageDataReady?: ReadinessRecord | null;
};

function readinessAsJsonb(value: ReadinessRecord | null): db.JSONValue | null {
    if (value == null) {
        return null;
    }
    return value as db.JSONValue;
}

/**
 * Deletes any existing job for the page (minting a new id), inserts with the provided fields,
 * and enqueues when ready. A new job id is required so FIFO dedup does not skip a remake.
 */
const createFreshPageZipperJob = async (
    conn: db.Queryable,
    params: CreateFreshPageZipperJobParams,
): Promise<PageZipperJob> => {
    const pageSource = params.pageSource ?? PageDataSource.Ropewiki;
    const now = new Date();

    await db.deletes('PageZipperJob', { pageId: params.pageId }).run(conn);

    const insertRow: s.PageZipperJob.Insertable = {
        pageId: params.pageId,
        pageSource,
        updatedAt: now,
    };

    if (params.pageReady !== undefined) {
        insertRow.pageReady = params.pageReady;
    }
    if (params.mapDataId !== undefined) {
        insertRow.mapDataId = params.mapDataId;
    }
    if (params.pageHasMapData !== undefined) {
        insertRow.pageHasMapData = params.pageHasMapData;
    }
    if (params.mapDataLegendItemsReady !== undefined) {
        insertRow.mapDataLegendItemsReady = readinessAsJsonb(params.mapDataLegendItemsReady);
    }
    if (params.imageDataReady !== undefined) {
        insertRow.imageDataReady = readinessAsJsonb(params.imageDataReady);
    }

    const row = await db.insert('PageZipperJob', insertRow).run(conn);
    const job = PageZipperJob.fromDbRow(row);
    if (job.readyToEnqueueMessage()) {
        await tryEnqueuePageZipperJob(job);
    }
    return job;
};

export default createFreshPageZipperJob;
