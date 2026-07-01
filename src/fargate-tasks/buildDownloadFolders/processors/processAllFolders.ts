import type { PoolClient } from 'pg';
import { PageDataSource } from 'ropegeo-common/models';
import getRopewikiPageView from '../../../api/getRopewikiPageView/database/getRopewikiPageView';
import { getRopewikiImageBundleRows } from '../database/getRopewikiImageBundleRows';
import { getRopewikiPageIdsNeedingFolder } from '../database/getRopewikiPageIdsNeedingFolder';
import { getRopewikiPageForFolderReadiness } from '../database/getRopewikiPageForFolderReadiness';
import { updateRopewikiFolderForPage } from '../database/updateRopewikiFolderForPage';
import { isRopewikiPageReadyForFolder } from '../readiness/isRopewikiPageReadyForFolder';
import {
    processSourceFolders,
    type FolderSourceLoop,
    type ProcessFoldersResult,
} from './processSourceFolders';

export type ProcessAllFoldersResult = ProcessFoldersResult;

const ropewikiFolderSourceLoop: FolderSourceLoop = {
    pageDataSource: PageDataSource.Ropewiki,
    getPageIdsNeedingFolder: getRopewikiPageIdsNeedingFolder,
    getOnlinePageView: getRopewikiPageView,
    getPageForFolder: getRopewikiPageForFolderReadiness,
    getImageBundleRows: getRopewikiImageBundleRows,
    updateFolderForPage: updateRopewikiFolderForPage,
    isPageReadyForFolder: isRopewikiPageReadyForFolder,
};

/** One entry per page data source; processed in parallel by {@link processAllFolders}. */
const folderSourceLoops: FolderSourceLoop[] = [ropewikiFolderSourceLoop];

/** Runs one build loop per page data source in parallel. */
export async function processAllFolders(
    conn: PoolClient,
): Promise<ProcessAllFoldersResult> {
    const results = await Promise.all(
        folderSourceLoops.map((loop) => processSourceFolders(conn, loop)),
    );

    // Merge per-source loop results into one summary for the job.
    return results.reduce(
        (acc, result) => ({
            built: acc.built + result.built,
            skipped: acc.skipped + result.skipped,
            failed: acc.failed + result.failed,
            total: acc.total + result.total,
        }),
        { built: 0, skipped: 0, failed: 0, total: 0 },
    );
}
