import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import { updateRopewikiFolderForPage } from '../../../../src/fargate-tasks/buildDownloadFolders/database/updateRopewikiFolderForPage';

describe('updateRopewikiFolderForPage (database)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });
    const conn: db.Queryable = pool;
    const regionId = 'f1000005-0005-4000-8000-000000000005';
    const pageId = 'f2000007-0007-4000-8000-000000000007';

    beforeAll(async () => {
        process.env.PAGE_ZIP_PUBLIC_BASE_URL = 'https://cdn.example.com/page-zips';
        await db.sql`DELETE FROM "RopewikiPage" WHERE id = ${db.param(pageId)}::uuid`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);
        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegionName: null,
                name: 'Update Folder Region',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/Update_Folder_Region',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: 'update-folder-page',
                name: 'Update Folder Page',
                region: regionId,
                url: 'https://ropewiki.com/Update_Folder_Page',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                quality: 1,
                userVotes: 1,
            })
            .run(conn);
    });

    afterEach(async () => {
        await db
            .update(
                'RopewikiPage',
                { downloadFolder: null, downloadFolderBuiltAt: null },
                { id: pageId },
            )
            .run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiPage" WHERE id = ${db.param(pageId)}::uuid`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);
        await pool.end();
    });

    it('sets downloadFolder URL and downloadFolderBuiltAt', async () => {
        await updateRopewikiFolderForPage(conn, pageId);

        const rows = await db
            .select('RopewikiPage', { id: pageId }, { columns: ['downloadFolder', 'downloadFolderBuiltAt'] })
            .run(conn);

        expect(rows[0]?.downloadFolder).toBe(`https://cdn.example.com/page-zips/${pageId}.zip`);
        expect(rows[0]?.downloadFolderBuiltAt).not.toBeNull();
    });
});
