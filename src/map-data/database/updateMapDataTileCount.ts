import * as db from 'zapatos/db';

export async function updateMapDataTileCount(
    conn: db.Queryable,
    mapDataId: string,
    tileCount: number,
    tileTotalBytes: number,
): Promise<void> {
    await db.sql`
        UPDATE "MapData"
        SET
            "tileCount" = ${db.param(tileCount)},
            "tileTotalBytes" = ${db.param(tileTotalBytes)},
            "updatedAt" = NOW()
        WHERE id = ${db.param(mapDataId)}::uuid
    `.run(conn);
}
