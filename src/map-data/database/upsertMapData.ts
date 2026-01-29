import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import MapData from '../types/mapData';

// Insert or update a MapData record.
// On conflict (same id), update all MapData fields and timestamps.
// If existing map data has no errorMessage and incoming map data has an errorMessage,
// skip upserting to avoid overwriting successful data with an error.
// Returns the upserted MapData object from the database (or existing one if skipped).
const upsertMapData = async (
    conn: db.Queryable,
    mapData: MapData,
): Promise<MapData> => {
    // If the incoming map data has an id, check if there's existing data
    if (mapData.id) {
        const existingRow = await db
            .selectOne('MapData', { id: mapData.id })
            .run(conn);

        // If existing data has no error and incoming data has an error, skip upserting
        if (existingRow && !existingRow.errorMessage && mapData.errorMessage) {
            console.log(`Skipping upsert for map data ${mapData.id} to avoid overwriting existing successful data with an error`);
            return MapData.fromDbRow(existingRow);
        }
    }

    const row = mapData.toDbRow();

    const results = await db
        .upsert('MapData', [row], ['id'], {
            updateColumns: ['gpx', 'kml', 'geoJson', 'vectorTile', 'updatedAt', 'sourceFileUrl', 'errorMessage'],
        })
        .run(conn);

    return MapData.fromDbRow(results[0]!);
};

export default upsertMapData;
