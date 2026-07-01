import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import { getRopewikiPageIdsNeedingFolder } from '../../../../src/fargate-tasks/buildDownloadFolders/database/getRopewikiPageIdsNeedingFolder';

describe('getRopewikiPageIdsNeedingFolder (database)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });
    const conn: db.Queryable = pool;
    const regionId = 'f1000002-0002-4000-8000-000000000002';
    const needingPageId = 'f2000002-0002-4000-8000-000000000002';
    const builtPageId = 'f2000003-0003-4000-8000-000000000003';
    const deletedPageId = 'f2000004-0004-4000-8000-000000000004';

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiPage" WHERE id IN (${db.vals([needingPageId, builtPageId, deletedPageId])})`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);
        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegionName: null,
                name: 'Needing Folder Region',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/Needing_Folder_Region',
            })
            .run(conn);
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "RopewikiPage" WHERE id IN (${db.vals([needingPageId, builtPageId, deletedPageId])})`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);
        await pool.end();
    });

    it('returns page ids without downloadFolder that are not deleted', async () => {
        await db
            .insert('RopewikiPage', {
                id: needingPageId,
                pageId: 'needing-folder-page',
                name: 'Needing Folder Page',
                region: regionId,
                url: 'https://ropewiki.com/Needing_Folder_Page',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                quality: 1,
                userVotes: 1,
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: builtPageId,
                pageId: 'built-folder-page',
                name: 'Built Folder Page',
                region: regionId,
                url: 'https://ropewiki.com/Built_Folder_Page',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                quality: 1,
                userVotes: 1,
                downloadFolder: 'https://cdn.example.com/page-zips/built.zip',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: deletedPageId,
                pageId: 'deleted-folder-page',
                name: 'Deleted Folder Page',
                region: regionId,
                url: 'https://ropewiki.com/Deleted_Folder_Page',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                quality: 1,
                userVotes: 1,
                deletedAt: new Date(),
            })
            .run(conn);

        const result = await getRopewikiPageIdsNeedingFolder(conn);

        expect(result).toEqual([needingPageId]);
    });
});
