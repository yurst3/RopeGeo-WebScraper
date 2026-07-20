export type MapDataBackfillCounts = {
    mapDataAttempted: number;
    mapDataUpdated: number;
    errors: number;
};

export const emptyMapDataBackfillCounts = (): MapDataBackfillCounts => ({
    mapDataAttempted: 0,
    mapDataUpdated: 0,
    errors: 0,
});

export const addMapDataBackfillCounts = (
    a: MapDataBackfillCounts,
    b: MapDataBackfillCounts,
): MapDataBackfillCounts => ({
    mapDataAttempted: a.mapDataAttempted + b.mapDataAttempted,
    mapDataUpdated: a.mapDataUpdated + b.mapDataUpdated,
    errors: a.errors + b.errors,
});
