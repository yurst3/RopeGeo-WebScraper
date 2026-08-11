import * as db from 'zapatos/db';

/**
 * Deletes every row in PageZipperJob.
 */
const deleteAllPageZipperJobs = async (conn: db.Queryable): Promise<number> => {
    const deleted = await db.deletes('PageZipperJob', {}).run(conn);
    return deleted.length;
};

export default deleteAllPageZipperJobs;
