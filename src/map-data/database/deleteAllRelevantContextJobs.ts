import * as db from 'zapatos/db';

/**
 * Deletes every row in MapDataRelevantContextJob.
 * MapDataRelevantContext.jobId FKs are ON DELETE SET NULL.
 */
const deleteAllRelevantContextJobs = async (conn: db.Queryable): Promise<number> => {
    const deleted = await db.deletes('MapDataRelevantContextJob', {}).run(conn);
    return deleted.length;
};

export default deleteAllRelevantContextJobs;
