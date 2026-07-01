import type { PoolClient } from 'pg';
import getRopewikiPageView from '../../../api/getRopewikiPageView/database/getRopewikiPageView';
import { countUnprocessedRopewikiImagesForPage } from '../database/countUnprocessedRopewikiImagesForPage';
import { getRopewikiPageForFolderReadiness } from '../database/getRopewikiPageForFolderReadiness';
import { isOnlineMiniMapReady } from './isOnlineMiniMapReady';

/** Returns true when a Ropewiki page has all assets required for a complete offline bundle. */
export async function isRopewikiPageReadyForFolder(
    conn: PoolClient,
    pageId: string,
): Promise<boolean> {
    const page = await getRopewikiPageForFolderReadiness(conn, pageId);
    if (page == null || page.deletedAt != null) {
        return false;
    }

    const unprocessedImageCount = await countUnprocessedRopewikiImagesForPage(conn, pageId);
    if (unprocessedImageCount > 0) {
        return false;
    }

    const view = await getRopewikiPageView(conn, pageId);
    if (view == null) {
        return false;
    }

    return isOnlineMiniMapReady(conn, page.region, view);
}
