import { Pool } from 'pg';
import * as db from 'zapatos/db';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import updateRegionTrueCounts from '../../../src/ropewiki/database/updateRegionTrueCounts';

describe('updateRegionTrueCounts (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;
    const parentRegionId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
    const childRegionId = 'bbbbbbbb-bbbb-4e48-99a6-81608cc0051d';
    const otherRegionId = 'aaaaaaaa-aaaa-4e48-99a6-81608cc0051d';

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiAkaName"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);

        await db
            .insert('RopewikiRegion', [
                {
                    id: parentRegionId,
                    parentRegionName: null,
                    name: 'Parent Region',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    rawPageCount: 0,
                    level: 0,
                    bestMonths: JSON.stringify([]),
                    url: 'https://ropewiki.com/Parent_Region',
                },
                {
                    id: childRegionId,
                    parentRegionName: 'Parent Region',
                    name: 'Child Region',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    rawPageCount: 0,
                    level: 1,
                    bestMonths: JSON.stringify([]),
                    url: 'https://ropewiki.com/Child_Region',
                },
                {
                    id: otherRegionId,
                    parentRegionName: null,
                    name: 'Other Region',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    rawPageCount: 0,
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
        await db.sql`DELETE FROM "RopewikiAkaName"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
        await pool.end();
    });

    it('sets truePageCount to direct page count and trueRegionCount to child region count', async () => {
        const parentPageId = '11111111-1111-1111-1111-111111111111';
        const childPage1Id = '22222222-2222-2222-2222-222222222221';
        const childPage2Id = '22222222-2222-2222-2222-222222222222';
        await db
            .insert('RopewikiPage', [
                {
                    id: parentPageId,
                    pageId: 'p1',
                    name: 'Parent Page',
                    region: parentRegionId,
                    url: 'https://ropewiki.com/Parent_Page',
                    months: [],
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                },
                {
                    id: childPage1Id,
                    pageId: 'p2',
                    name: 'Child Page 1',
                    region: childRegionId,
                    url: 'https://ropewiki.com/Child_Page_1',
                    months: [],
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                },
                {
                    id: childPage2Id,
                    pageId: 'p3',
                    name: 'Child Page 2',
                    region: childRegionId,
                    url: 'https://ropewiki.com/Child_Page_2',
                    months: [],
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                },
            ])
            .run(conn);

        await updateRegionTrueCounts(conn);

        const parentRow = await db.selectOne('RopewikiRegion', { id: parentRegionId }).run(conn);
        const childRow = await db.selectOne('RopewikiRegion', { id: childRegionId }).run(conn);
        const otherRow = await db.selectOne('RopewikiRegion', { id: otherRegionId }).run(conn);

        expect(parentRow!.truePageCount).toBe(1);
        expect(parentRow!.trueRegionCount).toBe(1);
        expect(parentRow!.truePageCountWithDescendents).toBe(3);

        expect(childRow!.truePageCount).toBe(2);
        expect(childRow!.trueRegionCount).toBe(0);
        expect(childRow!.truePageCountWithDescendents).toBe(2);

        expect(otherRow!.truePageCount).toBe(0);
        expect(otherRow!.trueRegionCount).toBe(0);
        expect(otherRow!.truePageCountWithDescendents).toBe(0);
    });

    it('updates all regions including siblings', async () => {
        const parentPageId = '33333333-3333-3333-3333-333333333333';
        const otherPageId = '44444444-4444-4444-4444-444444444444';
        await db
            .insert('RopewikiPage', [
                {
                    id: parentPageId,
                    pageId: 'p4',
                    name: 'Parent Page 2',
                    region: parentRegionId,
                    url: 'https://ropewiki.com/Parent_Page_2',
                    months: [],
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                },
                {
                    id: otherPageId,
                    pageId: 'p5',
                    name: 'Other Page',
                    region: otherRegionId,
                    url: 'https://ropewiki.com/Other_Page',
                    months: [],
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                },
            ])
            .run(conn);

        await updateRegionTrueCounts(conn);

        const parentRow = await db.selectOne('RopewikiRegion', { id: parentRegionId }).run(conn);
        const otherRow = await db.selectOne('RopewikiRegion', { id: otherRegionId }).run(conn);

        expect(parentRow!.truePageCount).toBe(1);
        expect(parentRow!.truePageCountWithDescendents).toBe(1);
        expect(otherRow!.truePageCount).toBe(1);
        expect(otherRow!.truePageCountWithDescendents).toBe(1);
    });

    it('excludes soft-deleted pages from counts', async () => {
        const pageId = '55555555-5555-5555-5555-555555555555';
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: 'p6',
                name: 'Deleted Page',
                region: parentRegionId,
                url: 'https://ropewiki.com/Deleted_Page',
                months: [],
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                deletedAt: '2025-01-02T00:00:00' as db.TimestampString,
            })
            .run(conn);

        await updateRegionTrueCounts(conn);

        const parentRow = await db.selectOne('RopewikiRegion', { id: parentRegionId }).run(conn);
        expect(parentRow!.truePageCount).toBe(0);
        expect(parentRow!.truePageCountWithDescendents).toBe(0);
    });
});
