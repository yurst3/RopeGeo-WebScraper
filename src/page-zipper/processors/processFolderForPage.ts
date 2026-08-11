import type { PoolClient } from 'pg';
import type { FolderSourceLoop } from './processSourceFolders';
import { persistFolderZip } from './persistFolderZip';

/**
 * Builds a page download ZIP, uploads to PageZipBucket (or .savedDownloadFolders locally),
 * and updates the page's downloadFolder URL.
 */
export async function processFolderForPage(
    conn: PoolClient,
    pageId: string,
    loop: Pick<
        FolderSourceLoop,
        'getOnlinePageView' | 'getPageForFolder' | 'getImageBundleRows' | 'updateFolderForPage'
    >,
): Promise<void> {
    const view = await loop.getOnlinePageView(conn, pageId);
    if (view == null) {
        throw new Error(`Online page view not found: ${pageId}`);
    }

    const page = await loop.getPageForFolder(conn, pageId);
    if (page == null) {
        throw new Error(`Page not found: ${pageId}`);
    }

    const images = await loop.getImageBundleRows(conn, pageId);
    await persistFolderZip(conn, pageId, page.region, view, images, loop.updateFolderForPage);
}
