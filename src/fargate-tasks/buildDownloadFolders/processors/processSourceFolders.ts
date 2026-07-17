import type { PoolClient } from 'pg';
import type * as db from 'zapatos/db';
import type { OnlinePageView } from 'ropegeo-common/models';
import type { PageDataSource } from 'ropegeo-common/models';
import { processFolderForPage } from './processFolderForPage';

export type PageForFolder = {
    region: string;
};

export type ImageBundleRow = {
    imageId: string;
    processedImageId: string;
    previewUrl: string | null;
    bannerUrl: string | null;
    fullUrl: string | null;
};

export type GetOnlinePageView = (
    conn: db.Queryable,
    pageId: string,
) => Promise<OnlinePageView | null>;

export type GetPageForFolder = (
    conn: db.Queryable,
    pageId: string,
) => Promise<PageForFolder | null>;

export type GetImageBundleRows = (
    conn: db.Queryable,
    pageId: string,
) => Promise<ImageBundleRow[]>;

export type UpdateFolderForPage = (
    conn: db.Queryable,
    pageId: string,
) => Promise<void>;

export type IsPageReadyForFolder = (
    conn: PoolClient,
    pageId: string,
) => Promise<boolean>;

export type FolderSourceLoop = {
    pageDataSource: PageDataSource;
    getPageIdsNeedingFolder: (conn: PoolClient) => Promise<string[]>;
    getOnlinePageView: GetOnlinePageView;
    getPageForFolder: GetPageForFolder;
    getImageBundleRows: GetImageBundleRows;
    updateFolderForPage: UpdateFolderForPage;
    isPageReadyForFolder: IsPageReadyForFolder;
};

export type ProcessFoldersResult = {
    built: number;
    skipped: number;
    failed: number;
    total: number;
};

/** Processes all pages for one data source that need download folders. */
export async function processSourceFolders(
    conn: PoolClient,
    loop: FolderSourceLoop,
): Promise<ProcessFoldersResult> {
    const pageIds = await loop.getPageIdsNeedingFolder(conn);
    if (pageIds.length === 0) {
        return { built: 0, skipped: 0, failed: 0, total: 0 };
    }

    let built = 0;
    let skipped = 0;
    let failed = 0;

    for (const pageId of pageIds) {
        try {
            const ready = await loop.isPageReadyForFolder(conn, pageId);
            if (!ready) {
                skipped += 1;
                continue;
            }
            await processFolderForPage(conn, pageId, loop);
            built += 1;
        } catch (error) {
            failed += 1;
            console.error(
                `Failed to build download folder for ${loop.pageDataSource} page ${pageId}:`,
                error,
            );
        }
    }

    return { built, skipped, failed, total: pageIds.length };
}
