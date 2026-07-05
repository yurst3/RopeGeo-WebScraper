import * as db from 'zapatos/db';
import type { LegendItem } from 'ropegeo-common/models';
import { legendInsertRowsFromLegend } from '../types/mapDataLegendItem';

const replaceMapDataLegendItems = async (
    conn: db.Queryable,
    mapDataId: string,
    legend: Record<string, LegendItem> | undefined,
): Promise<void> => {
    await Promise.all([
        db.deletes('MapDataMarkerLegendItem', { mapData: mapDataId }).run(conn),
        db.deletes('MapDataSegmentLegendItem', { mapData: mapDataId }).run(conn),
        db.deletes('MapDataPolygonLegendItem', { mapData: mapDataId }).run(conn),
    ]);

    if (legend == null || Object.keys(legend).length === 0) {
        return;
    }

    const { markerRows, segmentRows, polygonRows } = legendInsertRowsFromLegend(mapDataId, legend);
    await Promise.all([
        markerRows.length > 0
            ? db.insert('MapDataMarkerLegendItem', markerRows).run(conn)
            : Promise.resolve([]),
        segmentRows.length > 0
            ? db.insert('MapDataSegmentLegendItem', segmentRows).run(conn)
            : Promise.resolve([]),
        polygonRows.length > 0
            ? db.insert('MapDataPolygonLegendItem', polygonRows).run(conn)
            : Promise.resolve([]),
    ]);
};

export default replaceMapDataLegendItems;
