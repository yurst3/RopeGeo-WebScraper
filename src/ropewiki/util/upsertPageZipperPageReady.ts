import type { Queryable } from 'zapatos/db';
import { PageDataSource } from 'ropegeo-common/models';
import {
    upsertPageZipperJob,
    PageZipperJob,
    type ReadinessRecord,
} from '../../page-zipper/database/upsertPageZipperJob';
import tryEnqueuePageZipperJob from '../../page-zipper/sqs/tryEnqueuePageZipperJob';

/**
 * Seeds pageReady and imageDataReady for a PageZipperJob.
 * When pageHasMapData is false, the map readiness side is marked empty/ready.
 */
const upsertPageZipperPageReady = async (
    conn: Queryable,
    pageId: string,
    pageSource: PageDataSource,
    imageDataReady: ReadinessRecord,
    pageHasMapData?: boolean,
): Promise<PageZipperJob | undefined> => {
    const job = await upsertPageZipperJob(
        conn,
        pageId,
        pageSource,
        true,
        undefined,
        pageHasMapData,
        imageDataReady,
    );
    if (job != null && job.readyToEnqueueMessage()) {
        await tryEnqueuePageZipperJob(job);
    }
    return job;
};

export default upsertPageZipperPageReady;
export { upsertPageZipperPageReady };
export type { ReadinessRecord };
export { PageZipperJob };
