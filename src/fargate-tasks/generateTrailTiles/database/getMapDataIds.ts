import * as db from 'zapatos/db';

/**
 * Fetches all MapData row ids that have valid GeoJSON (errorMessage and deletedAt null).
 */
export const getMapDataIds = async (conn: db.Queryable): Promise<string[]> => {
    const rows = await db.sql<db.SQL, { id: string }[]>`
        SELECT m.id
        FROM "MapData" m
        WHERE m."errorMessage" IS NULL
          AND m."deletedAt" IS NULL
          AND m."geoJson" IS NOT NULL
        ORDER BY m.id
    `.run(conn);

    return rows.map((r) => r.id);
};
