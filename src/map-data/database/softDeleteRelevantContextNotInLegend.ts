import * as db from 'zapatos/db';

/**
 * Soft-delete context rows that are no longer current for this job:
 * legend items not in the set, or rows stamped with a different / null jobId.
 */
const softDeleteRelevantContextNotInLegend = async (
    conn: db.Queryable,
    mapDataId: string,
    jobId: string,
    legendItemIds: string[],
): Promise<void> => {
    const now = new Date();
    if (legendItemIds.length === 0) {
        await db
            .update(
                'MapDataRelevantContext',
                { deletedAt: now, updatedAt: now },
                { mapDataId, deletedAt: db.conditions.isNull },
            )
            .run(conn);
        return;
    }

    await db.sql`
        UPDATE "MapDataRelevantContext"
        SET "deletedAt" = ${db.param(now)},
            "updatedAt" = ${db.param(now)}
        WHERE "mapDataId" = ${db.param(mapDataId)}::uuid
          AND "deletedAt" IS NULL
          AND (
            "legendItemId" NOT IN (${db.vals(legendItemIds)})
            OR "jobId" IS DISTINCT FROM ${db.param(jobId)}::uuid
          )
    `.run(conn);
};

export default softDeleteRelevantContextNotInLegend;
