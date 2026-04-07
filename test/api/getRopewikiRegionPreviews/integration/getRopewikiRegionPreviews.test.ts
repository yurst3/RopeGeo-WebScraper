import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { RopewikiRegionPreviewsParams, type PagePreview, type RegionPreview } from 'ropegeo-common/models';
import * as db from 'zapatos/db';
import getRopewikiRegionPreviews from '../../../../src/api/getRopewikiRegionPreviews/util/getRopewikiRegionPreviews';

function isPagePreview(r: PagePreview | RegionPreview): r is PagePreview {
    return 'title' in r;
}
function isRegionPreview(r: PagePreview | RegionPreview): r is RegionPreview {
    return 'parents' in r;
}

describe('getRopewikiRegionPreviews (integration)', () => {
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

    const parentRegionId = 'f1000001-0001-4000-8000-000000000001';
    const childRegionId = 'f1000002-0002-4000-8000-000000000002';
    const pageInParentId = 'f2000001-0001-4000-8000-000000000001';
    const pageInChildId = 'f2000002-0002-4000-8000-000000000002';

    beforeAll(async () => {
        await db
            .sql`DELETE FROM "RopewikiPage" WHERE id IN (${db.param(pageInParentId)}, ${db.param(pageInChildId)})`.run(conn);
        await db
            .sql`DELETE FROM "RopewikiRegion" WHERE id IN (${db.param(parentRegionId)}, ${db.param(childRegionId)})`.run(conn);

        await db
            .insert('RopewikiRegion', {
                id: parentRegionId,
                parentRegionName: null,
                name: 'RegionPreviewsIntParent',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/RegionPreviewsIntParent',
            })
            .run(conn);
        await db
            .insert('RopewikiRegion', {
                id: childRegionId,
                parentRegionName: 'RegionPreviewsIntParent',
                name: 'RegionPreviewsIntChild',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 1,
                bestMonths: [],
                url: 'https://ropewiki.com/RegionPreviewsIntChild',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageInParentId,
                pageId: 'region-previews-int-parent-page',
                name: 'ParentPage',
                region: parentRegionId,
                url: 'https://ropewiki.com/ParentPage',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                quality: 2,
                userVotes: 5,
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageInChildId,
                pageId: 'region-previews-int-child-page',
                name: 'ChildPage',
                region: childRegionId,
                url: 'https://ropewiki.com/ChildPage',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                quality: 10,
                userVotes: 3,
            })
            .run(conn);
    });

    afterAll(async () => {
        await db
            .sql`DELETE FROM "RopewikiPage" WHERE id IN (${db.param(pageInParentId)}, ${db.param(pageInChildId)})`.run(conn);
        await db
            .sql`DELETE FROM "RopewikiRegion" WHERE id IN (${db.param(childRegionId)}, ${db.param(parentRegionId)})`.run(conn);
        await pool.end();
    });

    it('returns only direct children (pages in region + child regions), never the queried region', async () => {
        const params = RopewikiRegionPreviewsParams.fromQueryStringParams({
            limit: '20',
        });
        const result = await getRopewikiRegionPreviews(conn, parentRegionId, params);

        const pages = result.results.filter(isPagePreview);
        const regions = result.results.filter(isRegionPreview);
        // Direct children only: 1 page in parent (ParentPage), 1 child region (RegionPreviewsIntChild). Queried region and ChildPage (in child) are not included.
        expect(pages.length).toBe(1);
        expect(regions.length).toBe(1);
        const pageTitles = pages.map((p) => p.title);
        expect(pageTitles).toContain('ParentPage');
        expect(pageTitles).not.toContain('ChildPage');
        const regionNames = regions.map((r) => r.name);
        expect(regionNames).not.toContain('RegionPreviewsIntParent');
        expect(regionNames).toContain('RegionPreviewsIntChild');
    });

    it('orders results by quality (sort_key) descending', async () => {
        const params = RopewikiRegionPreviewsParams.fromQueryStringParams({
            limit: '20',
        });
        const result = await getRopewikiRegionPreviews(conn, parentRegionId, params);

        const pages = result.results.filter(isPagePreview);
        const regions = result.results.filter(isRegionPreview);
        expect(pages.length).toBe(1);
        expect(regions.length).toBe(1);
        // Region (RegionPreviewsIntChild) has best page score 10*3=30; ParentPage has 2*5=10, so region comes first
        const regionPreview = regions[0]!;
        const pagePreview = pages[0]!;
        expect(result.results.indexOf(regionPreview)).toBeLessThan(result.results.indexOf(pagePreview));
    });

    it('includes only direct children when querying by parent region', async () => {
        const params = RopewikiRegionPreviewsParams.fromQueryStringParams({
            limit: '20',
        });
        const result = await getRopewikiRegionPreviews(conn, parentRegionId, params);

        const pages = result.results.filter(isPagePreview);
        const regions = result.results.filter(isRegionPreview);
        expect(pages.some((p) => p.id === pageInParentId)).toBe(true);
        expect(pages.some((p) => p.id === pageInChildId)).toBe(false);
        expect(regions.some((r) => r.id === childRegionId)).toBe(true);
        expect(regions.some((r) => r.id === parentRegionId)).toBe(false);
    });

    it('when querying by child region only, returns only direct children (pages in that region, no sub-regions)', async () => {
        const params = RopewikiRegionPreviewsParams.fromQueryStringParams({
            limit: '20',
        });
        const result = await getRopewikiRegionPreviews(conn, childRegionId, params);

        const pages = result.results.filter(isPagePreview);
        const regions = result.results.filter(isRegionPreview);
        expect(pages).toHaveLength(1);
        expect(pages[0]!.title).toBe('ChildPage');
        expect(pages[0]!.id).toBe(pageInChildId);
        expect(regions).toHaveLength(0);
    });

    it('cursor pagination returns all items with no duplicates or skips at page boundaries', async () => {
        const paginationRegionId = 'f5000001-0001-4000-8000-000000000001';
        const pageIds = [
            'f5000002-0002-4000-8000-000000000001',
            'f5000002-0002-4000-8000-000000000002',
            'f5000002-0002-4000-8000-000000000003',
            'f5000002-0002-4000-8000-000000000004',
            'f5000002-0002-4000-8000-000000000005',
        ] as const;

        try {
            await db
                .insert('RopewikiRegion', {
                    id: paginationRegionId,
                    parentRegionName: null,
                    name: 'RegionPreviewsPagination',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    rawPageCount: 0,
                    level: 0,
                    bestMonths: [],
                    url: 'https://ropewiki.com/RegionPreviewsPagination',
                })
                .run(conn);
            for (let i = 0; i < pageIds.length; i++) {
                const pageId = pageIds[i]!;
                await db
                    .insert('RopewikiPage', {
                        id: pageId,
                        pageId: `region-previews-pagination-page-${i}`,
                        name: `PaginationPage${i}`,
                        region: paginationRegionId,
                        url: `https://ropewiki.com/PaginationPage${i}`,
                        latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                        quality: 1,
                        userVotes: 1,
                    })
                    .run(conn);
            }

            const fullResult = await getRopewikiRegionPreviews(
                conn,
                paginationRegionId,
                RopewikiRegionPreviewsParams.fromQueryStringParams({ limit: '20' }),
            );
            const fullOrderedIds = fullResult.results.map((r) => (r as { id: string }).id);

            const pageSize = 2;
            const collected: { id: string }[] = [];
            let nextCursor: string | null = null;
            do {
                const params = RopewikiRegionPreviewsParams.fromQueryStringParams({
                    limit: String(pageSize),
                    ...(nextCursor ? { cursor: nextCursor } : {}),
                });
                const result = await getRopewikiRegionPreviews(
                    conn,
                    paginationRegionId,
                    params,
                );
                collected.push(...result.results.map((r) => ({ id: (r as { id: string }).id })));
                nextCursor = result.nextCursor as string | null;
            } while (nextCursor);

            const collectedIds = collected.map((r) => r.id);
            expect(collectedIds).toHaveLength(fullOrderedIds.length);
            expect(new Set(collectedIds).size).toBe(collectedIds.length);
            expect(collectedIds).toEqual(fullOrderedIds);
        } finally {
            await db
                .sql`DELETE FROM "RopewikiPage" WHERE id = ANY(${db.param(pageIds)}::uuid[])`.run(conn);
            await db
                .sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(paginationRegionId)}`.run(conn);
        }
    });
});
