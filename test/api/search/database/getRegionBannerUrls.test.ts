import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as db from 'zapatos/db';
import getRegionBannerUrls from '../../../../src/api/search/database/getRegionBannerUrls';

describe('getRegionBannerUrls (integration)', () => {
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

    const parentRegionId = 'd1000001-0001-4000-8000-000000000001';
    const childRegionId = 'd1000002-0002-4000-8000-000000000002';
    const pageInParentId = 'e1000001-0001-4000-8000-000000000001';
    const pageInChildId = 'e1000002-0002-4000-8000-000000000002';

    beforeAll(async () => {
        await db
            .insert('RopewikiRegion', {
                id: parentRegionId,
                parentRegion: null,
                name: 'BannerTestParent',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/BannerTestParent',
            })
            .run(conn);
        await db
            .insert('RopewikiRegion', {
                id: childRegionId,
                parentRegion: parentRegionId,
                name: 'BannerTestChild',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 1,
                bestMonths: [],
                url: 'https://ropewiki.com/BannerTestChild',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageInParentId,
                pageId: 'banner-parent-1',
                name: 'Page In Parent',
                region: parentRegionId,
                url: 'https://ropewiki.com/Page_In_Parent',
                latestRevisionDate:
                    '2025-01-01T00:00:00' as db.TimestampString,
                quality: 1,
                userVotes: 2,
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageInChildId,
                pageId: 'banner-child-1',
                name: 'Page In Child',
                region: childRegionId,
                url: 'https://ropewiki.com/Page_In_Child',
                latestRevisionDate:
                    '2025-01-01T00:00:00' as db.TimestampString,
                quality: 5,
                userVotes: 10,
            })
            .run(conn);
        const parentBannerUrl = 'https://ropewiki.com/images/parent-banner.jpg';
        const childBannerUrl = 'https://ropewiki.com/images/child-banner.jpg';
        await db
            .insert('RopewikiImage', {
                ropewikiPage: pageInParentId,
                betaSection: null,
                linkUrl: 'https://ropewiki.com/File:parent-banner.jpg',
                fileUrl: parentBannerUrl,
                order: 1,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                ropewikiPage: pageInChildId,
                betaSection: null,
                linkUrl: 'https://ropewiki.com/File:child-banner.jpg',
                fileUrl: childBannerUrl,
                order: 1,
            })
            .run(conn);
    });

    afterAll(async () => {
        await db
            .sql`DELETE FROM "RopewikiImage" WHERE "ropewikiPage" IN (${db.param(pageInParentId)}, ${db.param(pageInChildId)})`.run(conn);
        await db
            .sql`DELETE FROM "RopewikiPage" WHERE id IN (${db.param(pageInParentId)}, ${db.param(pageInChildId)})`.run(conn);
        await db
            .sql`DELETE FROM "RopewikiRegion" WHERE id IN (${db.param(childRegionId)}, ${db.param(parentRegionId)})`.run(conn);
        await pool.end();
    });

    it('returns empty Map when regionIds is empty', async () => {
        const result = await getRegionBannerUrls(conn, []);
        expect(result.size).toBe(0);
    });

    it('returns banner fileUrl for child region (most popular page in that region)', async () => {
        const result = await getRegionBannerUrls(conn, [childRegionId]);
        expect(result.get(childRegionId)).toBe(
            'https://ropewiki.com/images/child-banner.jpg',
        );
    });

    it('returns banner of most popular page in subtree for parent (child page wins)', async () => {
        const result = await getRegionBannerUrls(conn, [parentRegionId]);
        expect(result.get(parentRegionId)).toBe(
            'https://ropewiki.com/images/child-banner.jpg',
        );
    });

    it('returns first banner by order when page has multiple banner images', async () => {
        const pageId = 'e1000003-0003-4000-8000-000000000003';
        const regionId = 'd1000003-0003-4000-8000-000000000003';
        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegion: null,
                name: 'BannerTestOrder',
                latestRevisionDate:
                    '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/BannerTestOrder',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: 'banner-order-1',
                name: 'Page Order Test',
                region: regionId,
                url: 'https://ropewiki.com/Page_Order_Test',
                latestRevisionDate:
                    '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                ropewikiPage: pageId,
                betaSection: null,
                linkUrl: 'https://ropewiki.com/File:second.jpg',
                fileUrl: 'https://ropewiki.com/images/second.jpg',
                order: 2,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                ropewikiPage: pageId,
                betaSection: null,
                linkUrl: 'https://ropewiki.com/File:first.jpg',
                fileUrl: 'https://ropewiki.com/images/first.jpg',
                order: 1,
            })
            .run(conn);

        const result = await getRegionBannerUrls(conn, [regionId]);
        expect(result.get(regionId)).toBe(
            'https://ropewiki.com/images/first.jpg',
        );

        await db
            .sql`DELETE FROM "RopewikiImage" WHERE "ropewikiPage" = ${db.param(pageId)}`.run(conn);
        await db
            .sql`DELETE FROM "RopewikiPage" WHERE id = ${db.param(pageId)}`.run(conn);
        await db
            .sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}`.run(conn);
    });

    it('returns null for region with no pages', async () => {
        const regionId = 'd1000004-0004-4000-8000-000000000004';
        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegion: null,
                name: 'BannerTestNoPages',
                latestRevisionDate:
                    '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/BannerTestNoPages',
            })
            .run(conn);

        const result = await getRegionBannerUrls(conn, [regionId]);
        expect(result.has(regionId)).toBe(false);

        await db
            .sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}`.run(conn);
    });

    it('returns multiple region banners in one call', async () => {
        const result = await getRegionBannerUrls(conn, [
            parentRegionId,
            childRegionId,
        ]);
        expect(result.get(parentRegionId)).toBe(
            'https://ropewiki.com/images/child-banner.jpg',
        );
        expect(result.get(childRegionId)).toBe(
            'https://ropewiki.com/images/child-banner.jpg',
        );
    });
});
