import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import MapData from '../types/mapData';

// Insert or update a MapData record. Single upsert: INSERT ... ON CONFLICT (id) DO UPDATE.
// When allowUpdates = false on conflict, the update is skipped; we log a warning and return the existing row.
// errorMessage is not overwritten when existing has no error and incoming has error (preserve successful data).
const upsertMapData = async (
    conn: db.Queryable,
    mapData: MapData,
): Promise<MapData> => {
    const row = mapData.toDbRow();

    const returned = await db.sql<db.SQL, (s.MapData.JSONSelectable)[]>`
        INSERT INTO "MapData" ("id", "gpx", "kml", "geoJson", "tiles", "sourceFileUrl", "errorMessage", "updatedAt", "deletedAt")
        VALUES (
            COALESCE(${db.param(row.id)}::uuid, gen_random_uuid()),
            ${db.param(row.gpx)},
            ${db.param(row.kml)},
            ${db.param(row.geoJson)},
            ${db.param(row.tiles)},
            ${db.param(row.sourceFileUrl)},
            ${db.param(row.errorMessage)},
            ${db.param(row.updatedAt)},
            ${db.param(row.deletedAt)}
        )
        ON CONFLICT (id) DO UPDATE SET
            "gpx" = EXCLUDED."gpx",
            "kml" = EXCLUDED."kml",
            "geoJson" = EXCLUDED."geoJson",
            "tiles" = EXCLUDED."tiles",
            "updatedAt" = EXCLUDED."updatedAt",
            "sourceFileUrl" = EXCLUDED."sourceFileUrl",
            "errorMessage" = EXCLUDED."errorMessage"
        WHERE "MapData"."allowUpdates" = true
          AND NOT ("MapData"."errorMessage" IS NULL AND EXCLUDED."errorMessage" IS NOT NULL)
        RETURNING *
    `.run(conn);

    if (returned.length > 0) return MapData.fromDbRow(returned[0]!);

    const id = row.id as string | undefined;
    if (id) {
        const existing = await db.selectOne('MapData', { id }).run(conn);
        if (existing) {
            if (existing.allowUpdates === false) {
                console.warn(`MapData row ${id} not updated: allowUpdates is false`);
            } else if (!existing.errorMessage && mapData.errorMessage) {
                console.log(`Skipping upsert for map data ${id} to avoid overwriting existing successful data with an error`);
            }
            return MapData.fromDbRow(existing);
        }
    }
    throw new Error('MapData insert returned no row');
};

export default upsertMapData;
