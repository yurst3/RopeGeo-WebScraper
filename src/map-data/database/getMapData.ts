import * as db from 'zapatos/db';
import MapData from '../types/mapData';
import getMapDataLegendItems from './getMapDataLegendItems';

/**
 * Fetches a MapData record by id.
 *
 * @param conn - Database connection (e.g. Pool or transaction client)
 * @param mapDataId - UUID of the MapData record
 * @returns The MapData instance if found, or null if no record exists
 */
const getMapData = async (
    conn: db.Queryable,
    mapDataId: string,
): Promise<MapData | undefined> => {
    const row = await db
        .selectOne('MapData', { id: mapDataId })
        .run(conn);

    if (!row) {
        return undefined;
    }

    const legendRows = await getMapDataLegendItems(conn, mapDataId);
    return MapData.fromDbRow(row, legendRows);
};

export default getMapData;
