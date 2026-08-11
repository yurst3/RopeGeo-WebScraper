import type { PoolClient } from 'pg';
import { PageDataSource } from 'ropegeo-common/models';
import deletePageZipperJob from './database/deletePageZipperJob';
import getPageZipperJobById from './database/getPageZipperJobById';
import { isRopewikiPageReadyForFolder } from './readiness/isRopewikiPageReadyForFolder';
import type { PageZipperJobEvent } from './types/pageZipperJobEvent';
import { processFolderForPage } from './processors/processFolderForPage';
import { ropewikiFolderSourceLoop } from './processors/ropewikiFolderSourceLoop';

export type PageZipperJobResult =
    | { status: 'missing_job' }
    | { status: 'not_ready' }
    | { status: 'complete' };

/**
 * Processes one PageZipper job: defensive readiness check, zip/upload/update, then delete the job.
 *
 * @param job - Parsed SQS job event
 * @param client - Database client
 */
export const main = async (
    job: PageZipperJobEvent,
    client: PoolClient,
): Promise<PageZipperJobResult> => {
    const existingJob = await getPageZipperJobById(client, job.id);
    if (existingJob == null) {
        console.warn(
            `PageZipperJob ${job.id} not found for page ${job.pageId}; dropping SQS message`,
        );
        return { status: 'missing_job' };
    }

    if (job.pageSource !== PageDataSource.Ropewiki) {
        throw new Error(
            `page-zipper main: unsupported pageSource ${job.pageSource} for page ${job.pageId}`,
        );
    }

    const ready = await isRopewikiPageReadyForFolder(client, job.pageId);
    if (!ready) {
        console.warn(
            `PageZipperJob ${job.id}: page ${job.pageId} failed defensive readiness check; leaving job for retry`,
        );
        return { status: 'not_ready' };
    }

    await processFolderForPage(client, job.pageId, ropewikiFolderSourceLoop);
    await deletePageZipperJob(client, job.id);

    console.log(`PageZipperJob ${job.id}: complete for page ${job.pageId}`);
    return { status: 'complete' };
};
