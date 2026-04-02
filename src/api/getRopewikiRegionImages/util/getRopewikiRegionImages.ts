import * as db from 'zapatos/db';
import {
    RopewikiRegionImagesResult,
    RopewikiRegionImagesParams,
    RopewikiRegionImageView,
} from 'ropegeo-common/classes';
import getAllowedRegionIds from '../../../ropewiki/database/getAllowedRegionIds';
import {
    getRegionImagesPage,
    cursorFromRow,
} from '../database/getRegionImagesPage';

/**
 * Fetches one page of RopewikiRegionImageView (banner images) for pages in the given region and its descendants,
 * ordered by page popularity (quality * userVotes). Uses cursor-based pagination via RopewikiRegionImagesParams.
 */
export default async function getRopewikiRegionImages(
    conn: db.Queryable,
    regionId: string,
    params: RopewikiRegionImagesParams,
): Promise<RopewikiRegionImagesResult> {
    const allowedRegionIds = await getAllowedRegionIds(conn, regionId);
    if (allowedRegionIds.length === 0) {
        return new RopewikiRegionImagesResult([], null);
    }

    const { items, hasMore } = await getRegionImagesPage(
        conn,
        allowedRegionIds,
        params,
    );

    const results = items.map(
        (row) =>
            new RopewikiRegionImageView({
                id: row.id,
                ropewikiPage: row.ropewikiPage,
                pageName: row.pageName,
                bannerUrl: row.bannerUrl,
                fullUrl: row.fullUrl,
                linkUrl: row.linkUrl,
                caption: row.caption ?? null,
            }),
    );

    const nextCursor = hasMore ? cursorFromRow(items[items.length - 1]!) : null;
    return new RopewikiRegionImagesResult(results, nextCursor);
}
