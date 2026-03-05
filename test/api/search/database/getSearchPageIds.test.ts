import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { SearchParams } from 'ropegeo-common';
import * as db from 'zapatos/db';
import { getSearchPageIds } from '../../../../src/api/search/database/getSearchPageIds';

describe('getSearchPageIds (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT
            ? parseInt(process.env.TEST_PORT, 10)
            : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;

    const parentRegionId = 'f0000001-0001-4000-8000-000000000001';
    const childRegionId = 'f0000002-0002-4000-8000-000000000002';
    const pageId = 'e0000001-0001-4000-8000-000000000001';
    const pageInParentId = 'e0000002-0002-4000-8000-000000000002';
    const pageAkaOnlyId = 'e0000003-0003-4000-8000-000000000003';

    beforeAll(async () => {
        await db
            .insert('RopewikiRegion', {
                id: parentRegionId,
                parentRegion: null,
                name: 'PageIdsTestParent',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                pageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/PageIdsTestParent',
            })
            .run(conn);
        await db
            .insert('RopewikiRegion', {
                id: childRegionId,
                parentRegion: parentRegionId,
                name: 'PageIdsTestChild',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                pageCount: 0,
                level: 1,
                bestMonths: [],
                url: 'https://ropewiki.com/PageIdsTestChild',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: 'pageids-test-1',
                name: 'PageIdsTestPageImlay',
                region: childRegionId,
                url: 'https://ropewiki.com/PageIdsTestPageImlay',
                latestRevisionDate:
                    '2025-01-01T00:00:00' as db.TimestampString,
                quality: 5,
                userVotes: 10,
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageInParentId,
                pageId: 'pageids-test-2',
                name: 'PageIdsTestParentPage',
                region: parentRegionId,
                url: 'https://ropewiki.com/PageIdsTestParentPage',
                latestRevisionDate:
                    '2025-01-01T00:00:00' as db.TimestampString,
                quality: 1,
                userVotes: 1,
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageAkaOnlyId,
                pageId: 'pageids-test-aka',
                name: 'ZzzQqxUnrelatedName',
                region: childRegionId,
                url: 'https://ropewiki.com/PageIdsTestAkaOnly',
                latestRevisionDate:
                    '2025-01-01T00:00:00' as db.TimestampString,
                quality: 1,
                userVotes: 1,
            })
            .run(conn);
        await db
            .insert('RopewikiAkaName', {
                ropewikiPage: pageAkaOnlyId,
                name: 'AkaOnlySearchTerm',
            })
            .run(conn);
    });

    afterAll(async () => {
        await db
            .sql`DELETE FROM "RopewikiPage" WHERE id IN (${db.param(pageId)}, ${db.param(pageInParentId)}, ${db.param(pageAkaOnlyId)})`.run(conn);
        await db
            .sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(childRegionId)}`.run(conn);
        await db
            .sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(parentRegionId)}`.run(conn);
        await pool.end();
    });

    const allowedRegionIds = [parentRegionId, childRegionId];

    it('returns items and hasMore false when results fit in limit', async () => {
        const params = new SearchParams(
            'PageIdsTest',
            0.1,
            true,
            true,
            false,
            null,
            'similarity',
            10,
            null,
        );
        const { items, hasMore } = await getSearchPageIds(
            conn,
            params,
            allowedRegionIds,
        );
        expect(items.length).toBe(4); // 2 pages + 2 regions
        expect(hasMore).toBe(false);
        const ids = new Set(items.map((c) => c.id));
        expect(ids.has(pageId)).toBe(true);
        expect(ids.has(pageInParentId)).toBe(true);
        expect(ids.has(parentRegionId)).toBe(true);
        expect(ids.has(childRegionId)).toBe(true);
    });

    it('returns at most limit items and hasMore true when more exist', async () => {
        const params = new SearchParams(
            'PageIdsTest',
            0.1,
            true,
            true,
            false,
            null,
            'similarity',
            2,
            null,
        );
        const { items, hasMore } = await getSearchPageIds(
            conn,
            params,
            allowedRegionIds,
        );
        expect(items.length).toBe(2);
        expect(hasMore).toBe(true);
    });

    it('cursor returns next page and hasMore false on last page', async () => {
        const paramsFirst = new SearchParams(
            'PageIdsTest',
            0.1,
            true,
            true,
            false,
            null,
            'similarity',
            2,
            null,
        );
        const { items: firstItems, hasMore: hasMoreFirst } =
            await getSearchPageIds(conn, paramsFirst, allowedRegionIds);
        expect(firstItems.length).toBe(2);
        expect(hasMoreFirst).toBe(true);

        const cursorEncoded = firstItems[1]!.encodeBase64();
        const paramsSecond = new SearchParams(
            'PageIdsTest',
            0.1,
            true,
            true,
            false,
            null,
            'similarity',
            2,
            cursorEncoded,
        );
        const { items: secondItems, hasMore: hasMoreSecond } =
            await getSearchPageIds(conn, paramsSecond, allowedRegionIds);
        expect(secondItems.length).toBe(2);
        expect(hasMoreSecond).toBe(false);

        const firstIds = new Set(firstItems.map((c) => c.id));
        const secondIds = new Set(secondItems.map((c) => c.id));
        for (const id of secondIds) {
            expect(firstIds.has(id)).toBe(false);
        }
        expect(firstIds.size + secondIds.size).toBe(4);
    });

    it('orders by similarity DESC, then type ASC, then id ASC', async () => {
        const params = new SearchParams(
            'PageIdsTest',
            0.1,
            true,
            true,
            false,
            null,
            'similarity',
            10,
            null,
        );
        const { items } = await getSearchPageIds(
            conn,
            params,
            allowedRegionIds,
        );
        for (let i = 1; i < items.length; i++) {
            const a = items[i - 1]!;
            const b = items[i]!;
            expect(a.sortKey >= b.sortKey).toBe(true);
            if (a.sortKey === b.sortKey) {
                expect(a.type <= b.type).toBe(true);
                if (a.type === b.type) {
                    expect(a.id <= b.id).toBe(true);
                }
            }
        }
    });

    it('respects includePages false (regions only)', async () => {
        const params = new SearchParams(
            'PageIdsTest',
            0.1,
            false,
            true,
            false,
            null,
            'similarity',
            10,
            null,
        );
        const { items } = await getSearchPageIds(
            conn,
            params,
            allowedRegionIds,
        );
        expect(items.every((c) => c.type === 'region')).toBe(true);
        expect(items.length).toBe(2);
    });

    it('respects includeRegions false (pages only)', async () => {
        const params = new SearchParams(
            'PageIdsTest',
            0.1,
            true,
            false,
            false,
            null,
            'similarity',
            10,
            null,
        );
        const { items } = await getSearchPageIds(
            conn,
            params,
            allowedRegionIds,
        );
        expect(items.every((c) => c.type === 'page')).toBe(true);
        expect(items.length).toBe(2);
    });

    it('with includeAka true, returns page matched by AKA name', async () => {
        const params = new SearchParams(
            'AkaOnlySearchTerm',
            0.1,
            true,
            false,
            true,
            null,
            'similarity',
            10,
            null,
        );
        const { items } = await getSearchPageIds(
            conn,
            params,
            allowedRegionIds,
        );
        const pageIds = items.filter((c) => c.type === 'page').map((c) => c.id);
        expect(pageIds).toContain(pageAkaOnlyId);
    });

    it('with includeAka false, excludes page matched only by AKA name', async () => {
        const params = new SearchParams(
            'AkaOnlySearchTerm',
            0.1,
            true,
            false,
            false,
            null,
            'similarity',
            10,
            null,
        );
        const { items } = await getSearchPageIds(
            conn,
            params,
            allowedRegionIds,
        );
        const pageIds = items.filter((c) => c.type === 'page').map((c) => c.id);
        expect(pageIds).not.toContain(pageAkaOnlyId);
    });

    it('returns empty when no matches above threshold', async () => {
        const params = new SearchParams(
            'XyZzNoMatchQqWw',
            0.99,
            true,
            true,
            false,
            null,
            'similarity',
            10,
            null,
        );
        const { items, hasMore } = await getSearchPageIds(
            conn,
            params,
            allowedRegionIds,
        );
        expect(items.length).toBe(0);
        expect(hasMore).toBe(false);
    });

    it('returns empty when allowedRegionIds is empty', async () => {
        const params = new SearchParams(
            'PageIdsTest',
            0.1,
            true,
            true,
            false,
            null,
            'similarity',
            10,
            null,
        );
        const { items, hasMore } = await getSearchPageIds(
            conn,
            params,
            [],
        );
        expect(items.length).toBe(0);
        expect(hasMore).toBe(false);
    });

    it('with order quality, returns pages and regions by quality score', async () => {
        const params = new SearchParams(
            'PageIdsTest',
            0.1,
            true,
            true,
            false,
            null,
            'quality',
            10,
            null,
        );
        const { items } = await getSearchPageIds(
            conn,
            params,
            allowedRegionIds,
        );
        expect(items.length).toBe(4);
        const pageItems = items.filter((c) => c.type === 'page');
        const regionItems = items.filter((c) => c.type === 'region');
        expect(pageItems.length).toBe(2);
        expect(regionItems.length).toBe(2);
        const highScorePage = pageItems.find((c) => c.id === pageId);
        const lowScorePage = pageItems.find((c) => c.id === pageInParentId);
        expect(highScorePage).toBeDefined();
        expect(lowScorePage).toBeDefined();
        expect(highScorePage!.sortKey).toBeGreaterThan(lowScorePage!.sortKey);
    });

    it('with order quality and cursor, returns next page', async () => {
        const paramsFirst = new SearchParams(
            'PageIdsTest',
            0.1,
            true,
            false,
            false,
            null,
            'quality',
            1,
            null,
        );
        const { items: firstItems, hasMore: hasMoreFirst } =
            await getSearchPageIds(conn, paramsFirst, allowedRegionIds);
        expect(firstItems.length).toBe(1);
        expect(hasMoreFirst).toBe(true);
        expect(firstItems[0]!.id).toBe(pageId);

        const paramsSecond = new SearchParams(
            'PageIdsTest',
            0.1,
            true,
            false,
            false,
            null,
            'quality',
            1,
            firstItems[0]!.encodeBase64(),
        );
        const { items: secondItems, hasMore: hasMoreSecond } =
            await getSearchPageIds(conn, paramsSecond, allowedRegionIds);
        expect(secondItems.length).toBe(1);
        expect(hasMoreSecond).toBe(false);
        expect(secondItems[0]!.id).toBe(pageInParentId);
    });
});
