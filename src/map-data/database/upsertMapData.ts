import * as db from 'zapatos/db';
import MapData from '../types/mapData';

// Insert or update a MapData record.
// On conflict (same id), update all MapData fields and timestamps.
// Returns the upserted MapData object from the database.
const upsertMapData = async (
    conn: db.Queryable,
    mapData: MapData,
): Promise<MapData> => {
    const row = mapData.toDbRow();

    const results = await db
        .upsert('MapData', [row], ['id'], {
            updateColumns: ['gpx', 'kml', 'geoJson', 'vectorTile', 'updatedAt'],
        })
        .run(conn);

    return MapData.fromDbRow(results[0]!);
};

export default upsertMapData;
