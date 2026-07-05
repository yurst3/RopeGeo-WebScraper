import * as db from 'zapatos/db';
import type { MapDataLegendRows } from '../types/mapDataLegendItem';

const getMapDataLegendItems = async (
    conn: db.Queryable,
    mapDataId: string,
): Promise<MapDataLegendRows> => {
    const [markerRows, segmentRows, polygonRows] = await Promise.all([
        db.select('MapDataMarkerLegendItem', { mapData: mapDataId }).run(conn),
        db.select('MapDataSegmentLegendItem', { mapData: mapDataId }).run(conn),
        db.select('MapDataPolygonLegendItem', { mapData: mapDataId }).run(conn),
    ]);
    return { markerRows, segmentRows, polygonRows };
};

export default getMapDataLegendItems;
