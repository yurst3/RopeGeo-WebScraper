import * as db from 'zapatos/db';
import PageZipperJob from '../types/pageZipperJob';

const getPageZipperJobById = async (
    conn: db.Queryable,
    jobId: string,
): Promise<PageZipperJob | undefined> => {
    const row = await db.selectOne('PageZipperJob', { id: jobId }).run(conn);
    return row != null ? PageZipperJob.fromDbRow(row) : undefined;
};

export default getPageZipperJobById;
