import * as db from 'zapatos/db';
import { SearchParams, SearchResults } from 'ropegeo-common';
import getAllowedRegionIds from '../database/getAllowedRegionIds';
import getPageRowsByIds from '../database/getPageRowsByIds';
import getRegionRowsByIds from '../database/getRegionRowsByIds';
import { getSearchPageIds } from '../database/getSearchPageIds';
import { enrichSearchResults } from './enrichSearchResults';

/**
 * Fuzzy search over RopewikiPage and RopewikiRegion names using pg_trgm word_similarity.
 * Uses DB-level cursor pagination; enriches only the current page.
 * Returns SearchResults (results + nextCursor) from ropegeo-common.
 */
const searchRopewiki = async (
    conn: db.Queryable,
    params: SearchParams,
): Promise<SearchResults> => {
    const {
        name,
        similarityThreshold,
        regionId,
    } = params;

    // Resolve which regions are searchable (optionally scoped by params.regionId).
    const allowedRegionIds = await getAllowedRegionIds(conn, regionId);
    if (allowedRegionIds.length === 0) {
        return new SearchResults([], null);
    }

    // Get one page of (type, id) matches from DB using cursor pagination.
    const { items, hasMore } = await getSearchPageIds(
        conn,
        params,
        allowedRegionIds,
    );

    if (items.length === 0) {
        return new SearchResults([], null);
    }

    // Split items into page ids and region ids for parallel lookups.
    const pageIds = items.filter((i) => i.type === 'page').map((i) => i.id);
    const regionIdsFromItems = items.filter((i) => i.type === 'region').map((i) => i.id);

    // Load full page and region rows for this page of items.
    const [pageRowsById, regionRowsById] = await Promise.all([
        getPageRowsByIds(conn, name, similarityThreshold, pageIds),
        getRegionRowsByIds(conn, regionIdsFromItems),
    ]);

    // Turn (type, id) items into PagePreview/RegionPreview with lineage and banners.
    const results = await enrichSearchResults(
        conn,
        items,
        pageRowsById,
        regionRowsById,
    );

    // nextCursor is the last item when there are more pages; null otherwise.
    return new SearchResults(results, hasMore ? items[items.length - 1]! : null);
};

export default searchRopewiki;
