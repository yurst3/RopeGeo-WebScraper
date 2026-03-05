import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { SearchParams, type PagePreview, type RegionPreview } from 'ropegeo-common';
import * as db from 'zapatos/db';
import searchRopewiki from '../../../../src/api/search/util/searchRopewiki';

function isPagePreview(r: PagePreview | RegionPreview): r is PagePreview {
    return 'title' in r;
}
function isRegionPreview(r: PagePreview | RegionPreview): r is RegionPreview {
    return 'parents' in r;
}

describe('searchRopewiki (integration)', () => {
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

    const parentRegionId = 'a0000001-0001-4000-8000-000000000001';
    const childRegionId = 'a0000002-0002-4000-8000-000000000002';
    const pageId = 'b0000001-0001-4000-8000-000000000001';
    const pageInParentId = 'b0000002-0002-4000-8000-000000000002';
    const pageAkaOnlyId = 'b0000003-0003-4000-8000-000000000003';

    beforeAll(async () => {
        await db
            .insert('RopewikiRegion', {
                id: parentRegionId,
                parentRegion: null,
                name: 'SearchTestParentRegion',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/SearchTestParentRegion',
            })
            .run(conn);
        await db
            .insert('RopewikiRegion', {
                id: childRegionId,
                parentRegion: parentRegionId,
                name: 'SearchTestChildRegion',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 1,
                bestMonths: [],
                url: 'https://ropewiki.com/SearchTestChildRegion',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: 'search-test-1',
                name: 'SearchTestPageImlay',
                region: childRegionId,
                url: 'https://ropewiki.com/SearchTestPageImlay',
                latestRevisionDate:
                    '2025-01-01T00:00:00' as db.TimestampString,
                quality: 5,
                userVotes: 10,
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageInParentId,
                pageId: 'search-test-2',
                name: 'SearchTestParentPage',
                region: parentRegionId,
                url: 'https://ropewiki.com/SearchTestParentPage',
                latestRevisionDate:
                    '2025-01-01T00:00:00' as db.TimestampString,
                quality: 1,
                userVotes: 1,
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageAkaOnlyId,
                pageId: 'search-test-aka',
                name: 'ZzzQqxUnrelatedName',
                region: childRegionId,
                url: 'https://ropewiki.com/SearchTestAkaOnly',
                latestRevisionDate:
                    '2025-01-01T00:00:00' as db.TimestampString,
                quality: 1,
                userVotes: 1,
            })
            .run(conn);
        await db
            .insert('RopewikiAkaName', {
                ropewikiPage: pageAkaOnlyId,
                name: 'XyzAkaOnlyMatch',
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

    const defaultSearchParams = {
        name: 'SearchTest',
        similarityThreshold: 0.1,
        includePages: true,
        includeRegions: true,
        includeAka: true,
        regionId: null as string | null,
        order: 'similarity' as const,
        limit: 50,
        cursor: null as null,
    };

    function params(
        overrides: Partial<
            Omit<typeof defaultSearchParams, 'order'> & {
                order?: 'similarity' | 'quality';
            }
        > = {},
    ): Parameters<typeof searchRopewiki>[1] {
        return { ...defaultSearchParams, ...overrides } as Parameters<
            typeof searchRopewiki
        >[1];
    }

    it('returns PagePreview and RegionPreview matching name above threshold', async () => {
        const { results } = await searchRopewiki(conn, params());

        const pages = results.filter(isPagePreview);
        const regions = results.filter(isRegionPreview);
        expect(pages.length).toBeGreaterThanOrEqual(1);
        expect(regions.length).toBeGreaterThanOrEqual(2);
        const pageMatch = pages.find((p) => p.title === 'SearchTestPageImlay');
        expect(pageMatch).toBeDefined();
        expect(pageMatch?.id).toBe(pageId);
        expect(pageMatch?.regions).toContain('SearchTestChildRegion');
    });

    it('filters by region ancestry when regionId provided', async () => {
        const { results: resultWithParent } = await searchRopewiki(
            conn,
            params({ regionId: parentRegionId }),
        );

        const pagesWithParent = resultWithParent.filter(isPagePreview);
        expect(pagesWithParent.some((p) => p.title === 'SearchTestPageImlay')).toBe(true);
    });

    it('excludes pages outside region ancestry when regionId is a different branch', async () => {
        const otherRegionId = 'c0000001-0001-4000-8000-000000000001';
        const { results } = await searchRopewiki(
            conn,
            params({ regionId: otherRegionId }),
        );

        expect(results.length).toBe(0);
    });

    it('respects includePages false', async () => {
        const { results } = await searchRopewiki(
            conn,
            params({ includePages: false }),
        );

        expect(results.every(isRegionPreview)).toBe(true);
    });

    it('respects includeRegions false', async () => {
        const { results } = await searchRopewiki(
            conn,
            params({ includeRegions: false }),
        );

        expect(results.every(isPagePreview)).toBe(true);
    });

    it('with includeAka true, returns page matched by AKA name', async () => {
        const { results } = await searchRopewiki(
            conn,
            params({
                name: 'XyzAkaOnlyMatch',
                includeRegions: false,
                includeAka: true,
            }),
        );

        const pages = results.filter(isPagePreview);
        const akaMatchedPage = pages.find((p) => p.id === pageAkaOnlyId);
        expect(akaMatchedPage).toBeDefined();
        expect(akaMatchedPage?.title).toBe('ZzzQqxUnrelatedName');
    });

    it('with includeAka false, excludes page matched only by AKA name', async () => {
        const { results } = await searchRopewiki(
            conn,
            params({
                name: 'XyzAkaOnlyMatch',
                includeRegions: false,
                includeAka: false,
            }),
        );

        const pages = results.filter(isPagePreview);
        const akaMatchedPage = pages.find((p) => p.id === pageAkaOnlyId);
        expect(akaMatchedPage).toBeUndefined();
    });

    it('returns empty results and empty nextCursor when no matches above threshold', async () => {
        const { results, nextCursor } = await searchRopewiki(
            conn,
            params({ name: 'XyZzNoMatchQqWw', similarityThreshold: 0.99 }),
        );

        expect(results).toEqual([]);
        expect(nextCursor).toBe('');
    });

    it('with order quality, ranks pages by quality * userVotes', async () => {
        const { results } = await searchRopewiki(
            conn,
            params({ includeRegions: false, order: 'quality' }),
        );

        const pages = results.filter(isPagePreview);
        expect(pages.length).toBe(2);
        const highScoreIndex = pages.findIndex(
            (p) => p.title === 'SearchTestPageImlay',
        );
        const lowScoreIndex = pages.findIndex(
            (p) => p.title === 'SearchTestParentPage',
        );
        expect(highScoreIndex).toBeGreaterThanOrEqual(0);
        expect(lowScoreIndex).toBeGreaterThanOrEqual(0);
        expect(highScoreIndex).toBeLessThan(lowScoreIndex);
    });

    it('with order quality, ranks regions by most popular page in subtree', async () => {
        const { results } = await searchRopewiki(
            conn,
            params({ order: 'quality' }),
        );

        const pages = results.filter(isPagePreview);
        const regions = results.filter(isRegionPreview);
        expect(pages.length).toBe(2);
        expect(regions.length).toBe(2);

        const lowScorePageIndex = results.findIndex(
            (r) => isPagePreview(r) && r.title === 'SearchTestParentPage',
        );
        expect(lowScorePageIndex).toBeGreaterThanOrEqual(0);

        const isHighScoreItem = (r: PagePreview | RegionPreview) =>
            (isPagePreview(r) && r.title === 'SearchTestPageImlay') ||
            (isRegionPreview(r) &&
                (r.name === 'SearchTestParentRegion' ||
                    r.name === 'SearchTestChildRegion'));
        results.forEach((r, idx) => {
            if (isHighScoreItem(r)) {
                expect(idx).toBeLessThan(lowScorePageIndex);
            }
        });
    });

    it('with order quality and regions only, returns regions ordered by best page score', async () => {
        const { results } = await searchRopewiki(
            conn,
            params({ includePages: false, order: 'quality' }),
        );

        const regions = results.filter(isRegionPreview);
        expect(regions.length).toBe(2);
        const parentRegion = regions.find(
            (r) => r.name === 'SearchTestParentRegion',
        );
        const childRegion = regions.find(
            (r) => r.name === 'SearchTestChildRegion',
        );
        expect(parentRegion).toBeDefined();
        expect(childRegion).toBeDefined();
        expect(results.indexOf(parentRegion!)).toBeGreaterThanOrEqual(0);
        expect(results.indexOf(childRegion!)).toBeGreaterThanOrEqual(0);
    });

    it('cursor pagination: first page has nextCursor when more results exist', async () => {
        const params = new SearchParams(
            'SearchTest',
            0.1,
            true,
            true,
            false,
            null,
            'similarity',
            2,
            null,
        );
        const { results, nextCursor } = await searchRopewiki(conn, params);
        expect(results.length).toBe(2);
        expect(nextCursor).not.toBe('');
    });

    it('cursor pagination: second page returns remaining results and empty nextCursor', async () => {
        const firstParams = new SearchParams(
            'SearchTest',
            0.1,
            true,
            true,
            false,
            null,
            'similarity',
            2,
            null,
        );
        const first = await searchRopewiki(conn, firstParams);
        expect(first.results.length).toBe(2);
        expect(first.nextCursor).not.toBe('');

        const secondParams = new SearchParams(
            'SearchTest',
            0.1,
            true,
            true,
            false,
            null,
            'similarity',
            2,
            first.nextCursor,
        );
        const second = await searchRopewiki(conn, secondParams);
        expect(second.results.length).toBe(2);
        expect(second.nextCursor).toBe('');

        const firstIds = new Set(
            first.results.map((r) => (r as PagePreview | RegionPreview).id),
        );
        const secondIds = new Set(
            second.results.map((r) => (r as PagePreview | RegionPreview).id),
        );
        for (const id of secondIds) {
            expect(firstIds.has(id)).toBe(false);
        }
        expect(firstIds.size + secondIds.size).toBe(4);
    });
});
