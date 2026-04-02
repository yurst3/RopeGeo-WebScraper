import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import { RopewikiRegionPreviewsParams } from 'ropegeo-common/classes';
import {
    getRegionPreviewsPageIds,
    cursorFromRow,
} from '../../../../src/api/getRopewikiRegionPreviews/database/getRegionPreviewsPageIds';

describe('getRegionPreviewsPageIds (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
    });

    afterAll(async () => {
        await pool.end();
    });

    it('returns only direct children (pages in region + child regions) ordered by quality (sort_key DESC, type ASC, id ASC)', async () => {
        const parentRegionId = 'd1000001-0001-4000-8000-000000000001';
        const childRegionId = 'd1000002-0002-4000-8000-000000000002';
        const page1Id = 'd2000001-0001-4000-8000-000000000001';
        const page2Id = 'd2000002-0002-4000-8000-000000000002';

        await db
            .insert('RopewikiRegion', {
                id: parentRegionId,
                parentRegionName: null,
                name: 'RegionPreviewsParent',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/RegionPreviewsParent',
            })
            .run(conn);
        await db
            .insert('RopewikiRegion', {
                id: childRegionId,
                parentRegionName: 'RegionPreviewsParent',
                name: 'RegionPreviewsChild',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 1,
                bestMonths: [],
                url: 'https://ropewiki.com/RegionPreviewsChild',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: page1Id,
                pageId: 'region-previews-page-1',
                name: 'RegionPreviewsPage1',
                region: parentRegionId,
                url: 'https://ropewiki.com/RegionPreviewsPage1',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                quality: 10,
                userVotes: 2,
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: page2Id,
                pageId: 'region-previews-page-2',
                name: 'RegionPreviewsPage2',
                region: childRegionId,
                url: 'https://ropewiki.com/RegionPreviewsPage2',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                quality: 5,
                userVotes: 4,
            })
            .run(conn);

        const params = RopewikiRegionPreviewsParams.fromQueryStringParams({ limit: '10' });
        const { items, hasMore } = await getRegionPreviewsPageIds(conn, parentRegionId, params);

        // Direct children only: 1 page in parent (page1), 1 child region (RegionPreviewsChild). Parent region and page2 (in child) are not included.
        expect(items.length).toBe(2);
        const pageIds = items.filter((r) => r.type === 'page').map((r) => r.id);
        const regionIds = items.filter((r) => r.type === 'region').map((r) => r.id);
        expect(pageIds).toContain(page1Id);
        expect(pageIds).not.toContain(page2Id);
        expect(regionIds).toContain(childRegionId);
        expect(regionIds).not.toContain(parentRegionId);
        expect(items.every((r) => r.type === 'page' || r.type === 'region')).toBe(true);
        expect(items.every((r) => typeof r.sort_key === 'number' && r.id)).toBe(true);
        for (let i = 1; i < items.length; i++) {
            const prev = items[i - 1]!;
            const curr = items[i]!;
            const prevKey = Number(prev.sort_key);
            const currKey = Number(curr.sort_key);
            expect(prevKey >= currKey).toBe(true);
            if (prevKey === currKey) {
                expect(prev.type <= curr.type).toBe(true);
                if (prev.type === curr.type) {
                    expect(prev.id <= curr.id).toBe(true);
                }
            }
        }
        expect(hasMore).toBe(false);
    });

    it('respects limit and returns hasMore when more rows exist', async () => {
        const regionId = 'd1000003-0003-4000-8000-000000000003';
        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegionName: null,
                name: 'RegionPreviewsLimit',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/RegionPreviewsLimit',
            })
            .run(conn);
        for (let i = 0; i < 5; i++) {
            const pageId = `d2000003-0003-4000-8000-00000000000${i}`;
            await db
                .insert('RopewikiPage', {
                    id: pageId,
                    pageId: `region-previews-limit-page-${i}`,
                    name: `RegionPreviewsLimitPage${i}`,
                    region: regionId,
                    url: `https://ropewiki.com/RegionPreviewsLimitPage${i}`,
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    quality: 1,
                    userVotes: 1,
                })
                .run(conn);
        }

        const params = RopewikiRegionPreviewsParams.fromQueryStringParams({ limit: '2' });
        const { items, hasMore } = await getRegionPreviewsPageIds(conn, regionId, params);

        expect(items.length).toBe(2);
        expect(hasMore).toBe(true);
    });

    it('cursorFromRow produces a RegionPreviewsCursor with sortKey, type, id', () => {
        const row = { type: 'page', id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', sort_key: 42 };
        const cursor = cursorFromRow(row);
        expect(cursor).toBeDefined();
        expect(cursor.sortKey).toBe(42);
        expect(cursor.type).toBe('page');
        expect(cursor.id).toBe(row.id);
        const encoded = cursor.encodeBase64();
        expect(typeof encoded).toBe('string');
        expect(encoded.length).toBeGreaterThan(0);
    });
});
