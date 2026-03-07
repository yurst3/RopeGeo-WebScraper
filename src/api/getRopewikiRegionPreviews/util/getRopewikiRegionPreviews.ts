import * as db from 'zapatos/db';
import { RopewikiRegionPreviewsResult, RopewikiRegionPreviewsParams } from 'ropegeo-common';
import getAllowedRegionIds from '../../../ropewiki/database/getAllowedRegionIds';
import { enrichRopewikiPreviews } from '../../../ropewiki/util/enrichRopewikiPreviews';
import getPageRowsByIds from '../../search/database/getPageRowsByIds';
import getRegionRowsByIds from '../../search/database/getRegionRowsByIds';
import {
    getRegionPreviewsPageIds,
    cursorFromRow,
} from '../database/getRegionPreviewsPageIds';

/**
 * Fetches one page of region previews (PagePreview | RegionPreview) for the given region and its descendants,
 * ordered by quality (same as search). Uses cursor-based pagination via RopewikiRegionPreviewsParams.
 */
export default async function getRopewikiRegionPreviews(
    conn: db.Queryable,
    regionId: string,
    params: RopewikiRegionPreviewsParams,
): Promise<RopewikiRegionPreviewsResult> {
    const allowedRegionIds = await getAllowedRegionIds(conn, regionId);
    if (allowedRegionIds.length === 0) {
        return new RopewikiRegionPreviewsResult([], null);
    }

    const { items, hasMore } = await getRegionPreviewsPageIds(conn, allowedRegionIds, params);

    if (items.length === 0) {
        return new RopewikiRegionPreviewsResult([], null);
    }

    const pageIds = items.filter((i) => i.type === 'page').map((i) => i.id);
    const regionIdsFromItems = items.filter((i) => i.type === 'region').map((i) => i.id);

    const [pageRowsById, regionRowsById] = await Promise.all([
        getPageRowsByIds(conn, '', 0, pageIds, { includeAka: true }),
        getRegionRowsByIds(conn, regionIdsFromItems),
    ]);

    const previewItems = items.map((r) => ({ type: r.type as 'page' | 'region', id: r.id }));
    const results = await enrichRopewikiPreviews(conn, previewItems, pageRowsById, regionRowsById);

    const nextCursor = hasMore ? cursorFromRow(items[items.length - 1]!) : null;
    return new RopewikiRegionPreviewsResult(results, nextCursor);
}
