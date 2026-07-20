import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import updateRopewikiPageAuthors from '../../../src/ropewiki/database/updateRopewikiPageAuthors';

describe('updateRopewikiPageAuthors (database)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });
    const conn: db.Queryable = pool;
    const regionId = 'b1000001-0001-4000-8000-000000000001';
    const pageId = 'b2000001-0001-4000-8000-000000000001';

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiPage" WHERE id = ${db.param(pageId)}::uuid`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);
        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegionName: null,
                name: 'Update Page Authors Region',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/Update_Page_Authors_Region',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageId,
                externalPageId: 'update-page-authors',
                name: 'Update Page Authors',
                region: regionId,
                url: 'https://ropewiki.com/Update_Page_Authors',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                quality: 1,
                userVotes: 1,
                authors: null,
            })
            .run(conn);
    });

    afterEach(async () => {
        await db.update('RopewikiPage', { authors: null }, { id: pageId }).run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiPage" WHERE id = ${db.param(pageId)}::uuid`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);
        await pool.end();
    });

    it('writes authors onto the page', async () => {
        await updateRopewikiPageAuthors(conn, pageId, ['Alice', 'Bob']);
        const row = await db.selectExactlyOne('RopewikiPage', { id: pageId }).run(conn);
        expect(row.authors).toEqual(['Alice', 'Bob']);
    });

    it('clears authors to null', async () => {
        await updateRopewikiPageAuthors(conn, pageId, ['Alice']);
        await updateRopewikiPageAuthors(conn, pageId, null);
        const row = await db.selectExactlyOne('RopewikiPage', { id: pageId }).run(conn);
        expect(row.authors).toBeNull();
    });
});
