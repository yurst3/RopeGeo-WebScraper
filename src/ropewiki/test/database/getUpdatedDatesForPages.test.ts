import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import getUpdatedDatesForPages from '../../database/getUpdatedDatesForPages';

describe('getUpdatedDatesForPages (integration)', () => {
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
        // Clean tables
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);

        // Insert a test region (required foreign key)
        await db
            .insert('RopewikiRegion', {
                id: testRegionId,
                parentRegion: null,
                name: 'Test Region',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);
    });

    afterEach(async () => {
        // Clean between tests
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
        await pool.end();
    });

    it('returns updatedAt dates for found pageIds', async () => {
        const pageId1 = 'page-1';
        const pageId2 = 'page-2';
        const pageId3 = 'page-3';
        const updatedAt1 = '2025-01-02T12:34:56' as db.TimestampString;
        const updatedAt2 = '2025-01-03T14:20:10' as db.TimestampString;
        const updatedAt3 = '2025-01-04T16:45:30' as db.TimestampString;

        await db
            .insert('RopewikiPage', [
                {
                    id: '11111111-1111-1111-1111-111111111111',
                    pageId: pageId1,
                    name: 'Page 1',
                    region: testRegionId,
                    url: 'https://example.com/page1',
                    updatedAt: updatedAt1,
                },
                {
                    id: '22222222-2222-2222-2222-222222222222',
                    pageId: pageId2,
                    name: 'Page 2',
                    region: testRegionId,
                    url: 'https://example.com/page2',
                    updatedAt: updatedAt2,
                },
                {
                    id: '33333333-3333-3333-3333-333333333333',
                    pageId: pageId3,
                    name: 'Page 3',
                    region: testRegionId,
                    url: 'https://example.com/page3',
                    updatedAt: updatedAt3,
                },
            ])
            .run(conn);

        const result = await getUpdatedDatesForPages(conn, [pageId1, pageId2, pageId3]);

        expect(result).toHaveProperty(pageId1);
        expect(result).toHaveProperty(pageId2);
        expect(result).toHaveProperty(pageId3);
        expect(result[pageId1]).not.toBeNull();
        expect(result[pageId2]).not.toBeNull();
        expect(result[pageId3]).not.toBeNull();
        expect(result[pageId1] instanceof Date).toBe(true);
        expect(result[pageId2] instanceof Date).toBe(true);
        expect(result[pageId3] instanceof Date).toBe(true);
        expect(result[pageId1]!.toISOString()).toBe(new Date(updatedAt1).toISOString());
        expect(result[pageId2]!.toISOString()).toBe(new Date(updatedAt2).toISOString());
        expect(result[pageId3]!.toISOString()).toBe(new Date(updatedAt3).toISOString());
    });

    it('returns null for pageIds not found in database', async () => {
        const pageId1 = 'non-existent-1';
        const pageId2 = 'non-existent-2';
        const pageId3 = 'non-existent-3';

        // No pages inserted, table is empty

        const result = await getUpdatedDatesForPages(conn, [pageId1, pageId2, pageId3]);

        expect(result).toHaveProperty(pageId1);
        expect(result).toHaveProperty(pageId2);
        expect(result).toHaveProperty(pageId3);
        expect(result[pageId1]).toBeNull();
        expect(result[pageId2]).toBeNull();
        expect(result[pageId3]).toBeNull();
    });

    it('returns mix of found and not found pageIds', async () => {
        const foundPageId = 'found-page';
        const notFoundPageId1 = 'not-found-1';
        const notFoundPageId2 = 'not-found-2';
        const updatedAt = '2025-01-05T10:15:20' as db.TimestampString;

        await db
            .insert('RopewikiPage', {
                id: '44444444-4444-4444-4444-444444444444',
                pageId: foundPageId,
                name: 'Found Page',
                region: testRegionId,
                url: 'https://example.com/found',
                updatedAt,
            })
            .run(conn);

        const result = await getUpdatedDatesForPages(conn, [foundPageId, notFoundPageId1, notFoundPageId2]);

        expect(result).toHaveProperty(foundPageId);
        expect(result).toHaveProperty(notFoundPageId1);
        expect(result).toHaveProperty(notFoundPageId2);
        expect(result[foundPageId]).not.toBeNull();
        expect(result[foundPageId] instanceof Date).toBe(true);
        expect(result[foundPageId]!.toISOString()).toBe(new Date(updatedAt).toISOString());
        expect(result[notFoundPageId1]).toBeNull();
        expect(result[notFoundPageId2]).toBeNull();
    });

    it('propagates database errors', async () => {
        const badPool = new Pool({
            user: process.env.TEST_USER,
            password: process.env.TEST_PASS,
            host: process.env.TEST_HOST,
            port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
            database: 'nonexistent_database_for_test_error_updated_dates',
        });

        await expect(getUpdatedDatesForPages(badPool, ['page-1'])).rejects.toBeDefined();

        await badPool.end();
    });
});

