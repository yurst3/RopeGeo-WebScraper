import * as db from 'zapatos/db';

const setRelevantContextJobError = async (
    conn: db.Queryable,
    jobId: string,
    errorMessage: string,
): Promise<void> => {
    const now = new Date();
    await db
        .update(
            'MapDataRelevantContextJob',
            { errorMessage, updatedAt: now },
            { id: jobId },
        )
        .run(conn);
};

export default setRelevantContextJobError;
