import { Pool } from 'pg';
import * as db from 'zapatos/db';
import { describe, it, expect, afterEach, beforeAll, afterAll } from '@jest/globals';
import setPagesDeletedAtForRegion from '../../../src/ropewiki/database/setPagesDeletedAtForRegion';

describe('setPagesDeletedAtForRegion (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;
    const testRegionId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
    const otherRegionId = 'aaaaaaaa-aaaa-4e48-99a6-81608cc0051d';

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);

        await db
            .insert('RopewikiRegion', [
                {
                    id: testRegionId,
                    parentRegion: null,
                    name: 'Test Region',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    pageCount: 0,
                    level: 0,
                    bestMonths: JSON.stringify([]),
                    url: 'https://ropewiki.com/Test_Region',
                },
                {
                    id: otherRegionId,
                    parentRegion: null,
                    name: 'Other Region',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    pageCount: 0,
                    level: 0,
                    bestMonths: JSON.stringify([]),
                    url: 'https://ropewiki.com/Other_Region',
                },
            ])
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

    it('sets deletedAt for all pages in the region', async () => {
        const page1Id = '11111111-1111-1111-1111-111111111111';
        const page2Id = '22222222-2222-2222-2222-222222222222';
        await db
            .insert('RopewikiPage', [
                {
                    id: page1Id,
                    pageId: '9999',
                    name: 'Page 1',
                    region: testRegionId,
                    url: 'https://ropewiki.com/Page_1',
                    months: [],
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                },
                {
                    id: page2Id,
                    pageId: '8888',
                    name: 'Page 2',
                    region: testRegionId,
                    url: 'https://ropewiki.com/Page_2',
                    months: [],
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                },
            ])
            .run(conn);

        const beforeRows = await db.select('RopewikiPage', { region: testRegionId }).run(conn);
        expect(beforeRows).toHaveLength(2);
        beforeRows.forEach((row) => expect(row.deletedAt).toBeNull());

        await setPagesDeletedAtForRegion(conn, testRegionId);

        const afterRows = await db.select('RopewikiPage', { region: testRegionId }).run(conn);
        expect(afterRows).toHaveLength(2);
        afterRows.forEach((row) => {
            expect(row.deletedAt).not.toBeNull();
            expect(new Date(row.deletedAt as string).getTime()).toBeCloseTo(Date.now(), -3);
        });
    });

    it('only affects pages for the specified regionUuid', async () => {
        const page1Id = '33333333-3333-3333-3333-333333333333';
        const page2Id = '44444444-4444-4444-4444-444444444444';
        await db
            .insert('RopewikiPage', [
                {
                    id: page1Id,
                    pageId: '7777',
                    name: 'Region1 Page',
                    region: testRegionId,
                    url: 'https://ropewiki.com/Region1_Page',
                    months: [],
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                },
                {
                    id: page2Id,
                    pageId: '6666',
                    name: 'Region2 Page',
                    region: otherRegionId,
                    url: 'https://ropewiki.com/Region2_Page',
                    months: [],
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                },
            ])
            .run(conn);

        await setPagesDeletedAtForRegion(conn, testRegionId);

        const region1Page = await db.select('RopewikiPage', { id: page1Id }).run(conn);
        expect(region1Page[0]?.deletedAt).not.toBeNull();

        const region2Page = await db.select('RopewikiPage', { id: page2Id }).run(conn);
        expect(region2Page[0]?.deletedAt).toBeNull();
    });

    it('does not update deletedAt for pages that already have deletedAt set', async () => {
        const page1Id = '55555555-5555-5555-5555-555555555555';
        const page2Id = '66666666-6666-6666-6666-666666666666';
        const oldDeletedAt = new Date('2025-01-01T10:00:00Z');

        await db
            .insert('RopewikiPage', [
                {
                    id: page1Id,
                    pageId: '5555',
                    name: 'Fresh Page',
                    region: testRegionId,
                    url: 'https://ropewiki.com/Fresh_Page',
                    months: [],
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                },
                {
                    id: page2Id,
                    pageId: '4444',
                    name: 'Already Deleted Page',
                    region: testRegionId,
                    url: 'https://ropewiki.com/Already_Deleted_Page',
                    months: [],
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    deletedAt: oldDeletedAt.toISOString() as db.TimestampString,
                },
            ])
            .run(conn);

        const beforeDeleted = await db.select('RopewikiPage', { id: page2Id }).run(conn);
        expect(beforeDeleted[0]?.deletedAt).not.toBeNull();
        const beforeDeletedAtValue = beforeDeleted[0]?.deletedAt as string;

        await new Promise((resolve) => setTimeout(resolve, 100));
        await setPagesDeletedAtForRegion(conn, testRegionId);

        const afterRows = await db.select('RopewikiPage', { region: testRegionId }).run(conn);
        expect(afterRows).toHaveLength(2);

        const previouslyDeletedRow = afterRows.find((r) => r.id === page2Id);
        expect(previouslyDeletedRow?.deletedAt).not.toBeNull();
        expect(previouslyDeletedRow!.deletedAt).toBe(beforeDeletedAtValue);

        const freshRow = afterRows.find((r) => r.id === page1Id);
        expect(freshRow?.deletedAt).not.toBeNull();
        expect(new Date(freshRow!.deletedAt as string).getTime()).toBeCloseTo(Date.now(), -3);
    });
});
