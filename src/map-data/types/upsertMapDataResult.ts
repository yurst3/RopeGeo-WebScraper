import type MapData from './mapData';

export type UpsertMapDataResult = {
    mapData: MapData;
    /** True when the INSERT/UPDATE was applied; false when skipped (e.g. allowUpdates or error preservation). */
    applied: boolean;
};
