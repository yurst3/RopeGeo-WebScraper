import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';

export type RelevanceContextJobRow = s.MapDataRelevantContextJob.JSONSelectable;

const getRelevantContextJobById = async (
    conn: db.Queryable,
    jobId: string,
): Promise<RelevanceContextJobRow | undefined> => {
    const row = await db.selectOne('MapDataRelevantContextJob', { id: jobId }).run(conn);
    return row ?? undefined;
};

export default getRelevantContextJobById;
