import * as db from 'zapatos/db';
import type { RelevanceJobError } from '../types/relevanceTypes';

const setRelevantContextJobErrors = async (
    conn: db.Queryable,
    jobId: string,
    errors: RelevanceJobError[],
): Promise<void> => {
    const now = new Date();
    // node-pg treats JS arrays as Postgres arrays; cast via db.param(..., true) for jsonb.
    await db
        .update(
            'MapDataRelevantContextJob',
            { errors: db.param(errors, true), updatedAt: now },
            { id: jobId },
        )
        .run(conn);
};

export default setRelevantContextJobErrors;
