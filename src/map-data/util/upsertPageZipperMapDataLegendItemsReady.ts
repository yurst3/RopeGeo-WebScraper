import type { Queryable } from 'zapatos/db';
import { PageDataSource } from 'ropegeo-common/models';
import {
    upsertPageZipperJob,
    PageZipperJob,
    type ReadinessRecord,
} from '../../page-zipper/database/upsertPageZipperJob';
import tryEnqueuePageZipperJob from '../../page-zipper/sqs/tryEnqueuePageZipperJob';

/**
 * Seeds mapDataId, pageHasMapData, and mapDataLegendItemsReady for a PageZipperJob.
 */
const upsertPageZipperMapDataLegendItemsReady = async (
    conn: Queryable,
    pageId: string,
    pageSource: PageDataSource,
    mapDataId: string,
    mapDataLegendItemsReady: ReadinessRecord,
): Promise<PageZipperJob | undefined> => {
    const job = await upsertPageZipperJob(
        conn,
        pageId,
        pageSource,
        undefined,
        mapDataId,
        true,
        undefined,
        mapDataLegendItemsReady,
    );
    if (job != null && job.readyToEnqueueMessage()) {
        await tryEnqueuePageZipperJob(job);
    }
    return job;
};

export default upsertPageZipperMapDataLegendItemsReady;
export { upsertPageZipperMapDataLegendItemsReady };
export type { ReadinessRecord };
export { PageZipperJob };
