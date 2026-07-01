import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { Pool } from 'pg';
import * as db from 'zapatos/db';
import { invalidateDownloadFolderForPages } from '../../../src/ropewiki/database/invalidateDownloadFolderForPage';
import { updateRopewikiFolderForPage } from '../../../src/fargate-tasks/buildDownloadFolders/database/updateRopewikiFolderForPage';

describe('invalidateDownloadFolderForPages (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });
    const conn: db.Queryable = pool;
    const pageId = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee';
    const regionId = 'bbbbbbbb-cccc-4ddd-eeee-ffffffffffff';

    beforeAll(async () => {
        process.env.PAGE_ZIP_PUBLIC_BASE_URL = 'https://cdn.example.com/page-zips';
        await db.sql`DELETE FROM "RopewikiPage" WHERE id = ${db.param(pageId)}::uuid`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);
        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegionName: null,
                name: 'Test Region',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: JSON.stringify([]),
                url: 'https://ropewiki.com/Test',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: '12345',
                name: 'Test Page',
                region: regionId,
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                url: 'https://ropewiki.com/Test_Page',
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

    it('clears downloadFolder and downloadFolderBuiltAt', async () => {
        await updateRopewikiFolderForPage(conn, pageId);

        const before = await db
            .select('RopewikiPage', { id: pageId }, { columns: ['downloadFolder', 'downloadFolderBuiltAt'] })
            .run(conn);
        expect(before[0]?.downloadFolder).toBe(`https://cdn.example.com/page-zips/${pageId}.zip`);
        expect(before[0]?.downloadFolderBuiltAt).not.toBeNull();

        await invalidateDownloadFolderForPages(conn, [pageId]);

        const after = await db
            .select('RopewikiPage', { id: pageId }, { columns: ['downloadFolder', 'downloadFolderBuiltAt'] })
            .run(conn);
        expect(after[0]?.downloadFolder).toBeNull();
        expect(after[0]?.downloadFolderBuiltAt).toBeNull();
    });
});
