import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import getAllPages from '../../../src/ropewiki/database/getAllPages';
import RopewikiPage from '../../../src/ropewiki/types/page';

describe('getAllPages (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;
    const testRegionId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);

        await db
            .insert('RopewikiRegion', {
                id: testRegionId,
                parentRegion: null,
                name: 'Test Region',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                pageCount: 0,
                level: 0,
                bestMonths: JSON.stringify([]),
                url: 'https://ropewiki.com/Test_Region',
            })
            .run(conn);
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
        await pool.end();
    });

    it('returns all non-deleted pages as RopewikiPage objects', async () => {
        const id1 = '11111111-1111-1111-1111-111111111111';
        const id2 = '22222222-2222-2222-2222-222222222222';

        await db
            .insert('RopewikiPage', [
                {
                    id: id1,
                    pageId: 'page-1',
                    name: 'Page One',
                    region: testRegionId,
                    url: 'https://example.com/page1',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                },
                {
                    id: id2,
                    pageId: 'page-2',
                    name: 'Page Two',
                    region: testRegionId,
                    url: 'https://example.com/page2',
                    latestRevisionDate: '2025-01-02T00:00:00' as db.TimestampString,
                },
            ])
            .run(conn);

        const result = await getAllPages(conn);

        expect(result).toHaveLength(2);
        expect(result.every((p) => p instanceof RopewikiPage)).toBe(true);

        const page1 = result.find((p) => p.id === id1);
        const page2 = result.find((p) => p.id === id2);

        expect(page1).toBeDefined();
        expect(page1?.pageid).toBe('page-1');
        expect(page1?.name).toBe('Page One');
        expect(page1?.url).toBe('https://example.com/page1');

        expect(page2).toBeDefined();
        expect(page2?.pageid).toBe('page-2');
        expect(page2?.name).toBe('Page Two');
    });

    it('returns empty array when no pages exist', async () => {
        const result = await getAllPages(conn);

        expect(result).toHaveLength(0);
        expect(result).toEqual([]);
    });

    it('excludes soft-deleted pages', async () => {
        const idActive = '33333333-3333-3333-3333-333333333333';
        const idDeleted = '44444444-4444-4444-4444-444444444444';
        const now = new Date();

        await db
            .insert('RopewikiPage', [
                {
                    id: idActive,
                    pageId: 'page-active',
                    name: 'Active Page',
                    region: testRegionId,
                    url: 'https://example.com/active',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    deletedAt: null,
                },
                {
                    id: idDeleted,
                    pageId: 'page-deleted',
                    name: 'Deleted Page',
                    region: testRegionId,
                    url: 'https://example.com/deleted',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    deletedAt: now as db.TimestampString,
                },
            ])
            .run(conn);

        const result = await getAllPages(conn);

        expect(result).toHaveLength(1);
        expect(result[0]?.id).toBe(idActive);
        expect(result[0]?.pageid).toBe('page-active');
    });

    it('propagates database errors', async () => {
        const badPool = new Pool({
            user: process.env.TEST_USER,
            password: process.env.TEST_PASS,
            host: process.env.TEST_HOST,
            port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
            database: 'nonexistent_database_for_test_error_get_all_pages',
        });

        await expect(getAllPages(badPool)).rejects.toBeDefined();

        await badPool.end();
    });
});
