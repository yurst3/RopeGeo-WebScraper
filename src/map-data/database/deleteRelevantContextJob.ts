import * as db from 'zapatos/db';

const deleteRelevantContextJob = async (conn: db.Queryable, jobId: string): Promise<void> => {
    await db.deletes('MapDataRelevantContextJob', { id: jobId }).run(conn);
};

export default deleteRelevantContextJob;
