import type { GetRopewikiPagePreviewRow } from 'ropegeo-common';
import { PageDataSource, PagePreview, RegionPreview } from 'ropegeo-common';
import type * as db from 'zapatos/db';
import getRopewikiRegionLineage from '../database/getRopewikiRegionLineage';
import getRegionBannerUrls from '../database/getRegionBannerUrls';

export type RopewikiPreviewItem = { type: 'page' | 'region'; id: string };

/** Page row shape required to build PagePreview (GetRopewikiPagePreviewRow + mapData and aka). */
export type RopewikiPreviewPageRow = GetRopewikiPagePreviewRow & {
    mapData: string | null;
    aka: string[];
};

/** Region row shape required to build RegionPreview. */
export type RopewikiPreviewRegionRow = {
    id: string;
    name: string;
    pageCount: number;
    regionCount: number;
};

type LineageEntry = { id: string; name: string };

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
 * Enriches paginated items (page/region ids in order) with Ropewiki lineage and region banner URLs,
 * then builds (PagePreview | RegionPreview)[] in the same order as items.
 * Shared by search and getRopewikiRegionPreviews.
 */
export async function enrichRopewikiPreviews(
    conn: db.Queryable,
    items: RopewikiPreviewItem[],
    pageRowsById: Map<string, RopewikiPreviewPageRow>,
    regionRowsById: Map<string, RopewikiPreviewRegionRow>,
): Promise<(PagePreview | RegionPreview)[]> {
    if (items.length === 0) return [];

    const pageIds = items.filter((i) => i.type === 'page').map((i) => i.id);
    const regionIdsFromItems = items.filter((i) => i.type === 'region').map((i) => i.id);

    const regionIdsNeeded = new Set<string>(regionIdsFromItems);
    for (const id of pageIds) {
        const row = pageRowsById.get(id);
        if (row) regionIdsNeeded.add(row.regionId);
    }

    const [lineageByRegionId, bannerByRegionId] = await Promise.all([
        fetchLineageByRegionId(conn, [...regionIdsNeeded]),
        getRegionBannerUrls(conn, regionIdsFromItems),
    ]);

    const results: (PagePreview | RegionPreview)[] = [];
    for (const item of items) {
        if (item.type === 'page') {
            const row = pageRowsById.get(item.id);
            if (!row) continue;
            const lineage = lineageByRegionId.get(row.regionId) ?? [];
            const regions =
                lineage.length > 0 ? lineage.map((r) => r.name) : [row.regionName];
            results.push(
                PagePreview.fromDbRow(row, row.mapData ?? null, regions, row.aka ?? []),
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
                    row.regionCount,
                    imageUrl,
                    PageDataSource.Ropewiki,
                ),
            );
        }
    }
    return results;
}
