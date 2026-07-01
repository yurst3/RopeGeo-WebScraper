import * as db from 'zapatos/db';

export type MapDataForFolderReadiness = {
    errorMessage: string | null;
    tileCount: number | null;
};

/** Loads MapData fields needed to verify vector tiles are ready for bundling. */
export async function getMapDataForFolderReadiness(
    conn: db.Queryable,
    mapDataId: string,
): Promise<MapDataForFolderReadiness | null> {
    const rows = await db
        .select(
            'MapData',
            { id: mapDataId },
            { columns: ['errorMessage', 'tileCount'] },
        )
        .run(conn);
    return rows[0] ?? null;
}
