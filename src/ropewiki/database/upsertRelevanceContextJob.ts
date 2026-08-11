import type { Queryable } from 'zapatos/db';
import { upsertRelevanceContextJobFromPage } from '../../map-data/database/upsertRelevanceContextJob';

const upsertRelevanceContextJob = async (
    conn: Queryable,
    pageId: string,
    makeDownloadFolder: boolean = true,
): Promise<void> => {
    await upsertRelevanceContextJobFromPage(conn, pageId, makeDownloadFolder);
};

export default upsertRelevanceContextJob;
