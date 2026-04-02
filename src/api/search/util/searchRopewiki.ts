import * as db from 'zapatos/db';
import { SearchParams, SearchResults } from 'ropegeo-common/classes';
import getAllowedRegionIds from '../../../ropewiki/database/getAllowedRegionIds';
import { enrichRopewikiPreviews } from '../../../ropewiki/util/enrichRopewikiPreviews';
import getPageRowsByIds from '../database/getPageRowsByIds';
import getRegionRowsByIds from '../database/getRegionRowsByIds';
import { getSearchPageIds } from '../database/getSearchPageIds';

/**
 * Search over Ropewiki pages and regions: similarity (trigram), quality (score), or distance
 * (inverse distance × quality × userVotes). Optional source allow-list and ACA difficulty
 * filter pages only. Uses all non-deleted regions (no region ancestry query param).
 */
const searchRopewiki = async (
    conn: db.Queryable,
    params: SearchParams,
): Promise<SearchResults> => {
    const { name, similarityThreshold, includeAka, order } = params;

    const allowedRegionIds = await getAllowedRegionIds(conn, null);
    if (allowedRegionIds.length === 0) {
        return new SearchResults([], null);
    }

    // Get one page of (type, id) matches from DB using cursor pagination.
    const { items, hasMore } = await getSearchPageIds(conn, params, allowedRegionIds);

    if (items.length === 0) {
        return new SearchResults([], null);
    }

    // Split items into page ids and region ids for parallel lookups.
    const pageIds = items.filter((i) => i.type === 'page').map((i) => i.id);
    const regionIdsFromItems = items.filter((i) => i.type === 'region').map((i) => i.id);

    const applyNameSimilarity =
        order === 'similarity' || (order === 'quality' && name !== '');

    // Load full page and region rows for this page of items.
    const [pageRowsById, regionRowsById] = await Promise.all([
        getPageRowsByIds(conn, name, similarityThreshold, pageIds, {
            includeAka,
            applyNameSimilarity,
        }),
        getRegionRowsByIds(conn, regionIdsFromItems),
    ]);

    // Turn (type, id) items into PagePreview/RegionPreview with lineage and banners.
    const previewItems = items.map((i) => ({ type: i.type, id: i.id }));
    const results = await enrichRopewikiPreviews(
        conn,
        previewItems,
        pageRowsById,
        regionRowsById,
    );

    // nextCursor is the last item when there are more pages; null otherwise.
    return new SearchResults(results, hasMore ? items[items.length - 1]! : null);
};

export default searchRopewiki;
