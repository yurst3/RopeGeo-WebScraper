import { PageDataSource } from 'ropegeo-common';
import type { RegionPreview } from 'ropegeo-common';

export type RegionRow = {
    id: string;
    name: string;
    url: string;
    pageCount: number;
};

/**
 * Converts a database region row and its parent region names to a RegionPreview.
 * parents should be ordered from immediate parent to root (e.g. from getRopewikiRegionLineage, lineage.slice(1).map(r => r.name)).
 * imageUrl is typically the banner of the region's most popular page (quality * userVotes across the region and its descendants).
 */
function regionToRegionPreview(
    row: RegionRow,
    parents: string[],
    imageUrl: string | null = null,
): RegionPreview {
    return {
        id: row.id,
        name: row.name,
        parents,
        pageCount: row.pageCount,
        imageUrl,
        source: PageDataSource.Ropewiki,
    };
}

export default regionToRegionPreview;
