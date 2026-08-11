import * as db from 'zapatos/db';

const deletePageZipperJob = async (conn: db.Queryable, jobId: string): Promise<void> => {
    await db.deletes('PageZipperJob', { id: jobId }).run(conn);
};

export default deletePageZipperJob;
