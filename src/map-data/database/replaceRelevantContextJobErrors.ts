import * as db from 'zapatos/db';
import type { RelevanceJobError } from '../types/relevanceTypes';

/**
 * Replaces all MapDataRelevantContextError rows for a job with the provided list.
 */
const replaceRelevantContextJobErrors = async (
    conn: db.Queryable,
    jobId: string,
    errors: RelevanceJobError[],
): Promise<void> => {
    await db.deletes('MapDataRelevantContextError', { jobId }).run(conn);
    if (errors.length === 0) {
        return;
    }

    const now = new Date();
    await db
        .insert(
            'MapDataRelevantContextError',
            errors.map((error) => ({
                jobId,
                legendItemId: error.legendItemId,
                input: error.input,
                errorMessage: error.errorMessage,
                updatedAt: now,
            })),
        )
        .run(conn);
};

export default replaceRelevantContextJobErrors;
