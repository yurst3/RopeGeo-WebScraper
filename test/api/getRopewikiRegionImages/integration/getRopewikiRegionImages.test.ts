import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { RopewikiRegionImagesParams } from 'ropegeo-common';
import * as db from 'zapatos/db';
import getRopewikiRegionImages from '../../../../src/api/getRopewikiRegionImages/util/getRopewikiRegionImages';

describe('getRopewikiRegionImages (integration)', () => {
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

    const parentRegionId = 'e1000001-0001-4000-8000-000000000001';
    const childRegionId = 'e1000002-0002-4000-8000-000000000002';
    const pageInParentId = 'e2000001-0001-4000-8000-000000000001';
    const pageInChildId = 'e2000002-0002-4000-8000-000000000002';
    const bannerImageParentId = 'e3000001-0001-4000-8000-000000000001';
    const bannerImageChildId = 'e3000002-0002-4000-8000-000000000002';
    const nonBannerImageId = 'e3000003-0003-4000-8000-000000000003';
    const betaSectionId = 'e4000001-0001-4000-8000-000000000001';
    const imageDataParentId = 'e4000002-0002-4000-8000-000000000002';
    const imageDataChildId = 'e4000003-0003-4000-8000-000000000003';

    beforeAll(async () => {
        await db
            .sql`DELETE FROM "RopewikiImage" WHERE "ropewikiPage" IN (${db.param(pageInParentId)}, ${db.param(pageInChildId)})`.run(conn);
        await db
            .sql`DELETE FROM "RopewikiBetaSection" WHERE "ropewikiPage" IN (${db.param(pageInParentId)}, ${db.param(pageInChildId)})`.run(conn);
        await db
            .sql`DELETE FROM "RopewikiPage" WHERE id IN (${db.param(pageInParentId)}, ${db.param(pageInChildId)})`.run(conn);
        await db
            .sql`DELETE FROM "RopewikiRegion" WHERE id IN (${db.param(parentRegionId)}, ${db.param(childRegionId)})`.run(conn);
        await db
            .sql`DELETE FROM "ImageData" WHERE id IN (${db.param(imageDataParentId)}, ${db.param(imageDataChildId)})`.run(conn);

        await db
            .insert('RopewikiRegion', {
                id: parentRegionId,
                parentRegionName: null,
                name: 'RegionImagesIntParent',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/RegionImagesIntParent',
            })
            .run(conn);
        await db
            .insert('RopewikiRegion', {
                id: childRegionId,
                parentRegionName: 'RegionImagesIntParent',
                name: 'RegionImagesIntChild',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 1,
                bestMonths: [],
                url: 'https://ropewiki.com/RegionImagesIntChild',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageInParentId,
                pageId: 'region-images-int-parent-page',
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
                pageId: 'region-images-int-child-page',
                name: 'ChildPage',
                region: childRegionId,
                url: 'https://ropewiki.com/ChildPage',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                quality: 10,
                userVotes: 3,
            })
            .run(conn);
        await db
            .insert('RopewikiBetaSection', {
                id: betaSectionId,
                ropewikiPage: pageInParentId,
                title: 'Intro',
                text: 'Intro text',
                order: 1,
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);
        await db
            .insert('ImageData', {
                id: imageDataParentId,
                bannerUrl: 'https://api.example.com/images/parent-banner.avif',
                fullUrl: 'https://api.example.com/images/parent-full.avif',
            })
            .run(conn);
        await db
            .insert('ImageData', {
                id: imageDataChildId,
                bannerUrl: 'https://api.example.com/images/child-banner.avif',
                fullUrl: 'https://api.example.com/images/child-full.avif',
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                id: bannerImageParentId,
                ropewikiPage: pageInParentId,
                betaSection: null,
                linkUrl: 'https://ropewiki.com/File:parent-banner.jpg',
                fileUrl: 'https://ropewiki.com/images/parent-banner.jpg',
                order: 1,
                processedImage: imageDataParentId,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                id: nonBannerImageId,
                ropewikiPage: pageInParentId,
                betaSection: betaSectionId,
                linkUrl: 'https://ropewiki.com/File:parent-non-banner.jpg',
                fileUrl: 'https://ropewiki.com/images/parent-non-banner.jpg',
                order: 2,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                id: bannerImageChildId,
                ropewikiPage: pageInChildId,
                betaSection: null,
                linkUrl: 'https://ropewiki.com/File:child-banner.jpg',
                fileUrl: 'https://ropewiki.com/images/child-banner.jpg',
                order: 1,
                processedImage: imageDataChildId,
            })
            .run(conn);
    });

    afterAll(async () => {
        await db
            .sql`DELETE FROM "RopewikiImage" WHERE id IN (${db.param(bannerImageParentId)}, ${db.param(bannerImageChildId)}, ${db.param(nonBannerImageId)})`.run(conn);
        await db
            .sql`DELETE FROM "RopewikiBetaSection" WHERE id = ${db.param(betaSectionId)}`.run(conn);
        await db
            .sql`DELETE FROM "RopewikiPage" WHERE id IN (${db.param(pageInParentId)}, ${db.param(pageInChildId)})`.run(conn);
        await db
            .sql`DELETE FROM "RopewikiRegion" WHERE id IN (${db.param(childRegionId)}, ${db.param(parentRegionId)})`.run(conn);
        await db
            .sql`DELETE FROM "ImageData" WHERE id IN (${db.param(imageDataParentId)}, ${db.param(imageDataChildId)})`.run(conn);
        await pool.end();
    });

    it('returns only banner images (betaSection IS NULL), excluding images with betaSection set', async () => {
        const params = RopewikiRegionImagesParams.fromQueryStringParams({
            limit: '10',
        });
        const result = await getRopewikiRegionImages(conn, parentRegionId, params);

        const imageIds = result.results.map((r) => r.id);
        expect(new Set(imageIds)).toEqual(
            new Set([bannerImageParentId, bannerImageChildId]),
        );
        expect(imageIds).not.toContain(nonBannerImageId);
    });

    it('orders images by page popularity (quality * userVotes) descending', async () => {
        const params = RopewikiRegionImagesParams.fromQueryStringParams({
            limit: '10',
        });
        const result = await getRopewikiRegionImages(conn, parentRegionId, params);

        expect(result.results).toHaveLength(2);
        const first = result.results[0]!;
        const second = result.results[1]!;
        expect(first.pageName).toBe('ChildPage');
        expect(second.pageName).toBe('ParentPage');
        expect(first.bannerUrl).toBe('https://api.example.com/images/child-banner.avif');
        expect(first.fullUrl).toBe('https://api.example.com/images/child-full.avif');
        expect(second.bannerUrl).toBe('https://api.example.com/images/parent-banner.avif');
        expect(second.fullUrl).toBe('https://api.example.com/images/parent-full.avif');
    });

    it('includes images from pages in nested (descendant) regions when querying by parent region', async () => {
        const params = RopewikiRegionImagesParams.fromQueryStringParams({
            limit: '10',
        });
        const result = await getRopewikiRegionImages(conn, parentRegionId, params);

        const pageNames = result.results.map((r) => r.pageName);
        expect(pageNames).toContain('ParentPage');
        expect(pageNames).toContain('ChildPage');
        expect(result.results.some((r) => r.pageId === pageInChildId)).toBe(true);
        expect(result.results.some((r) => r.pageId === pageInParentId)).toBe(true);
    });

    it('when querying by child region only, returns only that region’s page images', async () => {
        const params = RopewikiRegionImagesParams.fromQueryStringParams({
            limit: '10',
        });
        const result = await getRopewikiRegionImages(conn, childRegionId, params);

        expect(result.results.length).toBe(1);
        expect(result.results[0]!.pageId).toBe(pageInChildId);
        expect(result.results[0]!.pageName).toBe('ChildPage');
        expect(result.results[0]!.bannerUrl).toBe('https://api.example.com/images/child-banner.avif');
        expect(result.results[0]!.fullUrl).toBe('https://api.example.com/images/child-full.avif');
    });

    it('cursor pagination returns all items with no duplicates or skips at page boundaries', async () => {
        const paginationRegionId = 'e5000001-0001-4000-8000-000000000001';
        const paginationPageId = 'e5000002-0002-4000-8000-000000000002';
        const imageIds = [
            'e5000003-0003-4000-8000-000000000001',
            'e5000003-0003-4000-8000-000000000002',
            'e5000003-0003-4000-8000-000000000003',
            'e5000003-0003-4000-8000-000000000004',
            'e5000003-0003-4000-8000-000000000005',
        ] as const;
        const paginationImageDataIds = [
            'e5000004-0004-4000-8000-000000000001',
            'e5000004-0004-4000-8000-000000000002',
            'e5000004-0004-4000-8000-000000000003',
            'e5000004-0004-4000-8000-000000000004',
            'e5000004-0004-4000-8000-000000000005',
        ] as const;

        try {
            await db
                .insert('RopewikiRegion', {
                    id: paginationRegionId,
                    parentRegionName: null,
                    name: 'RegionImagesPagination',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    rawPageCount: 0,
                    level: 0,
                    bestMonths: [],
                    url: 'https://ropewiki.com/RegionImagesPagination',
                })
                .run(conn);
            await db
                .insert('RopewikiPage', {
                    id: paginationPageId,
                    pageId: 'region-images-pagination-page',
                    name: 'PaginationPage',
                    region: paginationRegionId,
                    url: 'https://ropewiki.com/PaginationPage',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    quality: 1,
                    userVotes: 1,
                })
                .run(conn);
            for (let i = 0; i < imageIds.length; i++) {
                const imageId = imageIds[i]!;
                const imageDataId = paginationImageDataIds[i]!;
                await db
                    .insert('ImageData', {
                        id: imageDataId,
                        bannerUrl: `https://api.example.com/images/pag-${i}-banner.avif`,
                        fullUrl: `https://api.example.com/images/pag-${i}-full.avif`,
                    })
                    .run(conn);
                await db
                    .insert('RopewikiImage', {
                        id: imageId,
                        ropewikiPage: paginationPageId,
                        betaSection: null,
                        linkUrl: `https://ropewiki.com/File:pag-${i}.jpg`,
                        fileUrl: `https://ropewiki.com/images/pag-${i}.jpg`,
                        order: i,
                        processedImage: imageDataId,
                    })
                    .run(conn);
            }

            const fullResult = await getRopewikiRegionImages(
                conn,
                paginationRegionId,
                RopewikiRegionImagesParams.fromQueryStringParams({ limit: '10' }),
            );
            const fullOrderedIds = fullResult.results.map((r) => r.id);

            const pageSize = 2;
            const collected: { id: string }[] = [];
            let nextCursor: string | null = null;
            do {
                const params = RopewikiRegionImagesParams.fromQueryStringParams({
                    limit: String(pageSize),
                    ...(nextCursor ? { cursor: nextCursor } : {}),
                });
                const result = await getRopewikiRegionImages(
                    conn,
                    paginationRegionId,
                    params,
                );
                collected.push(...result.results);
                nextCursor = result.nextCursor as string | null;
            } while (nextCursor);

            const collectedIds = collected.map((r) => r.id);
            expect(collectedIds).toHaveLength(5);
            expect(new Set(collectedIds).size).toBe(5);
            expect(collectedIds).toEqual(fullOrderedIds);
        } finally {
            await db
                .sql`DELETE FROM "RopewikiImage" WHERE id = ANY(${db.param(imageIds)}::uuid[])`.run(conn);
            await db
                .sql`DELETE FROM "ImageData" WHERE id = ANY(${db.param(paginationImageDataIds)}::uuid[])`.run(conn);
            await db
                .sql`DELETE FROM "RopewikiPage" WHERE id = ${db.param(paginationPageId)}`.run(conn);
            await db
                .sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(paginationRegionId)}`.run(conn);
        }
    });
});
