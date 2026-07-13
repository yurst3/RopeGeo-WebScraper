import * as db from 'zapatos/db';

/**
 * Legend item IDs that already have non-deleted context written by this job (checkpoint resume).
 */
const getLegendItemIdsCompletedForJob = async (
    conn: db.Queryable,
    mapDataId: string,
    jobId: string,
): Promise<Set<string>> => {
    const rows = await db
        .select(
            'MapDataRelevantContext',
            {
                mapDataId,
                jobId,
                deletedAt: db.conditions.isNull,
            },
            { columns: ['legendItemId'] },
        )
        .run(conn);

    return new Set(rows.map((row) => row.legendItemId));
};

export default getLegendItemIdsCompletedForJob;
