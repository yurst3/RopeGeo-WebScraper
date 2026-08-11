import findPageZipperJobInDlq from './findPageZipperJobInDlq';
import sendPageZipperSQSMessage from './sendPageZipperSQSMessage';
import type PageZipperJob from '../types/pageZipperJob';

const tryEnqueuePageZipperJob = async (job: PageZipperJob): Promise<void> => {
    const inDlq = await findPageZipperJobInDlq(job.id);
    if (inDlq) {
        console.log(
            `Skipping page zipper enqueue for job ${job.id}: matching message found in DLQ`,
        );
        return;
    }

    await sendPageZipperSQSMessage(job.toMessage());
};
export default tryEnqueuePageZipperJob;
