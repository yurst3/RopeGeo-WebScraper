import type { SearchCursor } from 'ropegeo-common';
import { PageDataSource, PagePreview, RegionPreview } from 'ropegeo-common';
import type * as db from 'zapatos/db';
import getRopewikiRegionLineage from '../../../ropewiki/database/getRopewikiRegionLineage';
import getRegionBannerUrls from '../database/getRegionBannerUrls';
import type { PageRow } from '../database/getPageRowsByIds';
import type { RegionRow } from '../database/getRegionRowsByIds';

export type { PageRow, RegionRow };

export type LineageEntry = { id: string; name: string };

async function fetchLineageByRegionId(
    conn: db.Queryable,
    regionIds: string[],
): Promise<Map<string, LineageEntry[]>> {
    const map = new Map<string, LineageEntry[]>();
    await Promise.all(
        regionIds.map(async (rid) => {
            const lineage = await getRopewikiRegionLineage(conn, rid);
            map.set(rid, lineage);
        }),
    );
    return map;
}

/**
 * Enriches paginated search items with lineage (for pages and regions) and banner
 * URLs (for regions). Fetches lineage and banners from the DB, then builds
 * (PagePreview | RegionPreview)[] in the same order as items.
 */
export async function enrichSearchResults(
    conn: db.Queryable,
    items: SearchCursor[],
    pageRowsById: Map<string, PageRow>,
    regionRowsById: Map<string, RegionRow>,
): Promise<(PagePreview | RegionPreview)[]> {
    if (items.length === 0) return [];

    // Collect page ids and region ids from this page of search items.
    const pageIds = items.filter((i) => i.type === 'page').map((i) => i.id);
    const regionIdsFromItems = items.filter((i) => i.type === 'region').map((i) => i.id);

    // Region ids we need lineage for: items that are regions, plus each page’s region.
    const regionIdsNeeded = new Set<string>(regionIdsFromItems);
    for (const id of pageIds) {
        const row = pageRowsById.get(id);
        if (row) regionIdsNeeded.add(row.regionId);
    }

    // Fetch lineage (for breadcrumbs) and region banner URLs in parallel.
    const [lineageByRegionId, bannerByRegionId] = await Promise.all([
        fetchLineageByRegionId(conn, [...regionIdsNeeded]),
        getRegionBannerUrls(conn, regionIdsFromItems),
    ]);

    // Build previews in the same order as items; pages get lineage, regions get parents + banner.
    const results: (PagePreview | RegionPreview)[] = [];
    for (const item of items) {
        if (item.type === 'page') {
            const row = pageRowsById.get(item.id);
            if (!row) continue;
            const lineage = lineageByRegionId.get(row.regionId) ?? [];
            const regions =
                lineage.length > 0 ? lineage.map((r) => r.name) : [row.regionName];
            results.push(
                PagePreview.fromDbRow(row, row.mapData ?? null, regions),
            );
        } else {
            const row = regionRowsById.get(item.id);
            if (!row) continue;
            const lineage = lineageByRegionId.get(item.id) ?? [];
            const parents = lineage.slice(1).map((r) => r.name);
            const imageUrl = bannerByRegionId.get(item.id) ?? null;
            results.push(
                new RegionPreview(
                    row.id,
                    row.name,
                    parents,
                    row.pageCount,
                    imageUrl,
                    PageDataSource.Ropewiki,
                ),
            );
        }
    }
    return results;
}
