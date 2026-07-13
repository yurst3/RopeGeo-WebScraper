import type { Queryable } from 'zapatos/db';
import { upsertRelevanceContextJobFromPage } from '../../map-data/database/upsertRelevanceContextJob';

const upsertRelevanceContextJob = async (conn: Queryable, pageId: string): Promise<void> => {
    await upsertRelevanceContextJobFromPage(conn, pageId);
};

export default upsertRelevanceContextJob;
