import type * as s from 'zapatos/schema';
import sendRelevanceSQSMessage from './sendRelevanceSQSMessage';
import findRelevanceJobInDlq from './findRelevanceJobInDlq';

const tryEnqueueRelevanceJob = async (
    job: s.MapDataRelevantContextJob.JSONSelectable,
): Promise<void> => {
    if (job.mapDataId == null || !job.pageReady) {
        return;
    }

    const inDlq = await findRelevanceJobInDlq(job.id);
    if (inDlq) {
        console.log(
            `Skipping relevance enqueue for job ${job.id}: matching message found in DLQ`,
        );
        return;
    }

    await sendRelevanceSQSMessage({
        id: job.id,
        mapDataId: job.mapDataId,
        pageId: job.pageId,
        pageSource: job.pageSource,
    });
};

export default tryEnqueueRelevanceJob;
