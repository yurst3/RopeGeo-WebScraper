import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as db from 'zapatos/db';
import { getRopewikiPageForFolderReadiness } from '../../../../src/fargate-tasks/buildDownloadFolders/database/getRopewikiPageForFolderReadiness';

describe('getRopewikiPageForFolderReadiness (database)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });
    const conn: db.Queryable = pool;
    const regionId = 'f1000001-0001-4000-8000-000000000001';
    const pageId = 'f2000001-0001-4000-8000-000000000001';

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiPage" WHERE id = ${db.param(pageId)}::uuid`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);
        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegionName: null,
                name: 'Folder Readiness Region',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/Folder_Readiness_Region',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: 'folder-readiness-page',
                name: 'Folder Readiness Page',
                region: regionId,
                url: 'https://ropewiki.com/Folder_Readiness_Page',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                quality: 1,
                userVotes: 1,
            })
            .run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiPage" WHERE id = ${db.param(pageId)}::uuid`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);
        await pool.end();
    });

    it('returns null when page does not exist', async () => {
        await expect(
            getRopewikiPageForFolderReadiness(conn, '00000000-0000-4000-8000-000000000099'),
        ).resolves.toBeNull();
    });

    it('returns id, deletedAt, and region for an existing page', async () => {
        await expect(getRopewikiPageForFolderReadiness(conn, pageId)).resolves.toEqual({
            id: pageId,
            deletedAt: null,
            region: regionId,
        });
    });
});
