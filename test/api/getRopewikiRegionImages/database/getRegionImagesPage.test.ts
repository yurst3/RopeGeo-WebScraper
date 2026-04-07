import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import { RopewikiRegionImagesParams } from 'ropegeo-common/models';
import {
    getRegionImagesPage,
    cursorFromRow,
} from '../../../../src/api/getRopewikiRegionImages/database/getRegionImagesPage';

describe('getRegionImagesPage (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiImage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
        await db.sql`DELETE FROM "ImageData"`.run(conn);
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "RopewikiImage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
        await db.sql`DELETE FROM "ImageData"`.run(conn);
    });

    afterAll(async () => {
        await pool.end();
    });

    it('returns banner images for pages in allowed regions ordered by page popularity (sort_key DESC)', async () => {
        const regionId = 'd1000001-0001-4000-8000-000000000001';
        const page1Id = 'd2000001-0001-4000-8000-000000000001';
        const page2Id = 'd2000002-0002-4000-8000-000000000002';
        const image1Id = 'd3000001-0001-4000-8000-000000000001';
        const image2Id = 'd3000002-0002-4000-8000-000000000002';
        const imageData1Id = 'd4000001-0001-4000-8000-000000000001';
        const imageData2Id = 'd4000002-0002-4000-8000-000000000002';

        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegionName: null,
                name: 'RegionImagesParent',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/RegionImagesParent',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: page1Id,
                pageId: 'region-images-page-1',
                name: 'RegionImagesPage1',
                region: regionId,
                url: 'https://ropewiki.com/RegionImagesPage1',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                quality: 10,
                userVotes: 2,
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: page2Id,
                pageId: 'region-images-page-2',
                name: 'RegionImagesPage2',
                region: regionId,
                url: 'https://ropewiki.com/RegionImagesPage2',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                quality: 5,
                userVotes: 4,
            })
            .run(conn);
        await db
            .insert('ImageData', {
                id: imageData1Id,
                bannerUrl: 'https://api.example.com/images/img1-banner.avif',
                fullUrl: 'https://api.example.com/images/img1-full.avif',
            })
            .run(conn);
        await db
            .insert('ImageData', {
                id: imageData2Id,
                bannerUrl: 'https://api.example.com/images/img2-banner.avif',
                fullUrl: 'https://api.example.com/images/img2-full.avif',
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                id: image1Id,
                ropewikiPage: page1Id,
                betaSection: null,
                linkUrl: 'https://ropewiki.com/File:img1.jpg',
                fileUrl: 'https://ropewiki.com/images/img1.jpg',
                order: 1,
                processedImage: imageData1Id,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                id: image2Id,
                ropewikiPage: page2Id,
                betaSection: null,
                linkUrl: 'https://ropewiki.com/File:img2.jpg',
                fileUrl: 'https://ropewiki.com/images/img2.jpg',
                order: 1,
                processedImage: imageData2Id,
            })
            .run(conn);

        const params = RopewikiRegionImagesParams.fromQueryStringParams({ limit: '10' });
        const allowedRegionIds = [regionId];
        const { items, hasMore } = await getRegionImagesPage(conn, allowedRegionIds, params);

        expect(items.length).toBe(2);
        expect(items.every((r) => r.id && r.ropewikiPage && r.pageName && r.linkUrl)).toBe(true);
        expect(items.every((r) => r.bannerUrl != null)).toBe(true);
        expect(items.every((r) => r.fullUrl != null)).toBe(true);
        expect(Number(items[0]!.sort_key)).toBeGreaterThanOrEqual(Number(items[1]!.sort_key));
        expect(items[0]!.pageName).toBe('RegionImagesPage1');
        expect(items[1]!.pageName).toBe('RegionImagesPage2');
        expect(hasMore).toBe(false);
    });

    it('respects limit and returns hasMore when more images exist', async () => {
        const regionId = 'd1000003-0003-4000-8000-000000000003';
        const pageId = 'd2000003-0003-4000-8000-000000000003';
        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegionName: null,
                name: 'RegionImagesLimit',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/RegionImagesLimit',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: 'region-images-limit-page',
                name: 'RegionImagesLimitPage',
                region: regionId,
                url: 'https://ropewiki.com/RegionImagesLimitPage',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                quality: 1,
                userVotes: 1,
            })
            .run(conn);
        for (let i = 0; i < 3; i++) {
            const imageDataId = `d4000003-0003-4000-8000-00000000000${i + 1}`;
            await db
                .insert('ImageData', {
                    id: imageDataId,
                    bannerUrl: `https://api.example.com/images/limit-${i}-banner.avif`,
                    fullUrl: `https://api.example.com/images/limit-${i}-full.avif`,
                })
                .run(conn);
            await db
                .insert('RopewikiImage', {
                    ropewikiPage: pageId,
                    betaSection: null,
                    linkUrl: `https://ropewiki.com/File:limit-${i}.jpg`,
                    fileUrl: `https://ropewiki.com/images/limit-${i}.jpg`,
                    order: i,
                    processedImage: imageDataId,
                })
                .run(conn);
        }

        const params = RopewikiRegionImagesParams.fromQueryStringParams({ limit: '2' });
        const { items, hasMore } = await getRegionImagesPage(conn, [regionId], params);

        expect(items.length).toBe(2);
        expect(items.every((r) => r.bannerUrl != null)).toBe(true);
        expect(items.every((r) => r.fullUrl != null)).toBe(true);
        expect(hasMore).toBe(true);
    });

    it('returns only items with non-null bannerUrl and fullUrl', async () => {
        const regionId = 'd1000004-0004-4000-8000-000000000004';
        const pageId = 'd2000004-0004-4000-8000-000000000004';
        const imageWithBannerId = 'd3000004-0004-4000-8000-000000000004';
        const imageNoBannerId = 'd3000005-0005-4000-8000-000000000005';
        const imageDataId = 'd4000004-0004-4000-8000-000000000004';

        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegionName: null,
                name: 'RegionImagesNullFileUrl',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/RegionImagesNullFileUrl',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: 'region-images-null-page',
                name: 'RegionImagesNullPage',
                region: regionId,
                url: 'https://ropewiki.com/RegionImagesNullPage',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                quality: 1,
                userVotes: 1,
            })
            .run(conn);
        await db
            .insert('ImageData', {
                id: imageDataId,
                bannerUrl: 'https://api.example.com/images/with-banner.avif',
                fullUrl: 'https://api.example.com/images/with-full.avif',
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                id: imageWithBannerId,
                ropewikiPage: pageId,
                betaSection: null,
                linkUrl: 'https://ropewiki.com/File:with.jpg',
                fileUrl: 'https://ropewiki.com/images/with.jpg',
                order: 0,
                processedImage: imageDataId,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                id: imageNoBannerId,
                ropewikiPage: pageId,
                betaSection: null,
                linkUrl: 'https://ropewiki.com/File:nobanner.jpg',
                fileUrl: 'https://ropewiki.com/images/nobanner.jpg',
                order: 1,
                processedImage: null,
            })
            .run(conn);

        const params = RopewikiRegionImagesParams.fromQueryStringParams({ limit: '10' });
        const { items, hasMore } = await getRegionImagesPage(conn, [regionId], params);

        expect(items.length).toBe(1);
        expect(items.every((r) => r.bannerUrl != null)).toBe(true);
        expect(items.every((r) => r.fullUrl != null)).toBe(true);
        expect(items[0]!.id).toBe(imageWithBannerId);
        expect(items[0]!.bannerUrl).toBe('https://api.example.com/images/with-banner.avif');
        expect(items[0]!.fullUrl).toBe('https://api.example.com/images/with-full.avif');
        expect(hasMore).toBe(false);
    });

    it('cursorFromRow produces a RegionImagesCursor with sortKey, pageId, imageId', () => {
        const row = {
            sort_key: 42,
            ropewikiPage: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            id: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
        };
        const cursor = cursorFromRow(row);
        expect(cursor).toBeDefined();
        expect(cursor.sortKey).toBe(42);
        expect(cursor.pageId).toBe(row.ropewikiPage);
        expect(cursor.imageId).toBe(row.id);
        const encoded = cursor.encodeBase64();
        expect(typeof encoded).toBe('string');
        expect(encoded.length).toBeGreaterThan(0);
    });
});
