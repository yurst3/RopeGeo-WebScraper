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
    const parentRegionId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
    const childRegionId = 'bbbbbbbb-bbbb-4e48-99a6-81608cc0051d';
    const otherRegionId = 'aaaaaaaa-aaaa-4e48-99a6-81608cc0051d';

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);

        await db
            .insert('RopewikiRegion', [
                {
                    id: parentRegionId,
                    parentRegion: null,
                    name: 'Parent Region',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    rawPageCount: 0,
                    level: 0,
                    bestMonths: JSON.stringify([]),
                    url: 'https://ropewiki.com/Parent_Region',
                },
                {
                    id: childRegionId,
                    parentRegion: parentRegionId,
                    name: 'Child Region',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    rawPageCount: 0,
                    level: 1,
                    bestMonths: JSON.stringify([]),
                    url: 'https://ropewiki.com/Child_Region',
                },
                {
                    id: otherRegionId,
                    parentRegion: null,
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
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
        await pool.end();
    });

    it('sets deletedAt for all pages in the region and descendant regions', async () => {
        const parentPageId = '11111111-1111-1111-1111-111111111111';
        const childPageId = '22222222-2222-2222-2222-222222222222';
        await db
            .insert('RopewikiPage', [
                {
                    id: parentPageId,
                    pageId: '9999',
                    name: 'Parent Page',
                    region: parentRegionId,
                    url: 'https://ropewiki.com/Parent_Page',
                    months: [],
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                },
                {
                    id: childPageId,
                    pageId: '8888',
                    name: 'Child Page',
                    region: childRegionId,
                    url: 'https://ropewiki.com/Child_Page',
                    months: [],
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                },
            ])
            .run(conn);

        const beforeParent = await db.select('RopewikiPage', { region: parentRegionId }).run(conn);
        const beforeChild = await db.select('RopewikiPage', { region: childRegionId }).run(conn);
        expect(beforeParent).toHaveLength(1);
        expect(beforeChild).toHaveLength(1);
        expect(beforeParent[0]!.deletedAt).toBeNull();
        expect(beforeChild[0]!.deletedAt).toBeNull();

        await setPagesDeletedAtForRegion(conn, parentRegionId);

        const afterParent = await db.select('RopewikiPage', { region: parentRegionId }).run(conn);
        const afterChild = await db.select('RopewikiPage', { region: childRegionId }).run(conn);
        expect(afterParent[0]!.deletedAt).not.toBeNull();
        expect(afterChild[0]!.deletedAt).not.toBeNull();
        expect(new Date(afterParent[0]!.deletedAt as string).getTime()).toBeCloseTo(Date.now(), -3);
        expect(new Date(afterChild[0]!.deletedAt as string).getTime()).toBeCloseTo(Date.now(), -3);
    });

    it('does not affect pages in other (non-descendant) regions', async () => {
        const parentPageId = '33333333-3333-3333-3333-333333333333';
        const otherPageId = '44444444-4444-4444-4444-444444444444';
        await db
            .insert('RopewikiPage', [
                {
                    id: parentPageId,
                    pageId: '7777',
                    name: 'Parent Region Page',
                    region: parentRegionId,
                    url: 'https://ropewiki.com/Parent_Page',
                    months: [],
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                },
                {
                    id: otherPageId,
                    pageId: '6666',
                    name: 'Other Region Page',
                    region: otherRegionId,
                    url: 'https://ropewiki.com/Other_Page',
                    months: [],
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                },
            ])
            .run(conn);

        await setPagesDeletedAtForRegion(conn, parentRegionId);

        const parentPage = await db.select('RopewikiPage', { id: parentPageId }).run(conn);
        expect(parentPage[0]?.deletedAt).not.toBeNull();

        const otherPage = await db.select('RopewikiPage', { id: otherPageId }).run(conn);
        expect(otherPage[0]?.deletedAt).toBeNull();
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
                    region: parentRegionId,
                    url: 'https://ropewiki.com/Fresh_Page',
                    months: [],
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                },
                {
                    id: page2Id,
                    pageId: '4444',
                    name: 'Already Deleted Page',
                    region: parentRegionId,
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
        await setPagesDeletedAtForRegion(conn, parentRegionId);

        const afterRows = await db
            .select('RopewikiPage', { region: db.conditions.isIn([parentRegionId, childRegionId]) })
            .run(conn);
        expect(afterRows).toHaveLength(2);

        const previouslyDeletedRow = afterRows.find((r) => r.id === page2Id);
        expect(previouslyDeletedRow?.deletedAt).not.toBeNull();
        expect(previouslyDeletedRow!.deletedAt).toBe(beforeDeletedAtValue);

        const freshRow = afterRows.find((r) => r.id === page1Id);
        expect(freshRow?.deletedAt).not.toBeNull();
        expect(new Date(freshRow!.deletedAt as string).getTime()).toBeCloseTo(Date.now(), -3);
    });
});
