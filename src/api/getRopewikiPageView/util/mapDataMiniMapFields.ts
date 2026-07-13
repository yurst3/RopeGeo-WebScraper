export type MapDataBounds = {
    north: number;
    south: number;
    east: number;
    west: number;
};

/** Parses MapData.bounds jsonb into a numeric WGS84 box, or null when invalid. */
export function parseMapDataBounds(raw: unknown): MapDataBounds | null {
    if (raw == null || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    if (
        typeof o.north !== 'number' ||
        typeof o.south !== 'number' ||
        typeof o.east !== 'number' ||
        typeof o.west !== 'number'
    ) {
        return null;
    }
    return {
        north: o.north,
        south: o.south,
        east: o.east,
        west: o.west,
    };
}

/**
 * Page minimaps require both tilesTemplate and bounds. If either is missing, clear both
 * so callers fall back to a centered region minimap.
 */
export function normalizeTilesTemplateAndBounds(
    tilesTemplate: string | null,
    bounds: MapDataBounds | null,
): { tilesTemplate: string | null; bounds: MapDataBounds | null } {
    if (tilesTemplate == null) {
        return { tilesTemplate: null, bounds: null };
    }
    if (bounds == null) {
        return { tilesTemplate: null, bounds: null };
    }
    return { tilesTemplate, bounds };
}

export function resolveRouteMapDataId(mapDataId: string | null | undefined): string | null {
    if (mapDataId == null || typeof mapDataId !== 'string' || mapDataId.length === 0) {
        return null;
    }
    return mapDataId;
}
