import type { Queryable } from 'zapatos/db';
import {
    upsertPageZipperJob as upsertPageZipperJobCore,
    PageZipperJob,
} from '../../page-zipper/database/upsertPageZipperJob';
import tryEnqueuePageZipperJob from '../../page-zipper/sqs/tryEnqueuePageZipperJob';

/**
 * Relevance-processor wrapper: flips one legend item key to true when map readiness is seeded.
 */
const flipPageZipperLegendItemReady = async (
    conn: Queryable,
    pageId: string,
    legendItemId: string,
): Promise<PageZipperJob | undefined> => {
    const job = await upsertPageZipperJobCore(
        conn,
        pageId,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        legendItemId,
    );
    if (job != null && job.readyToEnqueueMessage()) {
        await tryEnqueuePageZipperJob(job);
    }
    return job;
};

export default flipPageZipperLegendItemReady;
export { flipPageZipperLegendItemReady };
export { PageZipperJob };
