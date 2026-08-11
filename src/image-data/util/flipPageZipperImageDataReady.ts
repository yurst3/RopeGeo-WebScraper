import type { Queryable } from 'zapatos/db';
import { PageDataSource } from 'ropegeo-common/models';
import {
    upsertPageZipperJob,
    PageZipperJob,
} from '../../page-zipper/database/upsertPageZipperJob';
import tryEnqueuePageZipperJob from '../../page-zipper/sqs/tryEnqueuePageZipperJob';

/**
 * Flips one page image key to true in imageDataReady when that map is already seeded.
 */
const flipPageZipperImageDataReady = async (
    conn: Queryable,
    pageId: string,
    pageSource: PageDataSource,
    pageImageId: string,
): Promise<PageZipperJob | undefined> => {
    const job = await upsertPageZipperJob(
        conn,
        pageId,
        pageSource,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        pageImageId,
    );
    if (job != null && job.readyToEnqueueMessage()) {
        await tryEnqueuePageZipperJob(job);
    }
    return job;
};

export default flipPageZipperImageDataReady;
export { flipPageZipperImageDataReady };
export { PageZipperJob };
