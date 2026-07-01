import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as db from 'zapatos/db';
import { getRopewikiImageBundleRows } from '../../../../src/fargate-tasks/buildDownloadFolders/database/getRopewikiImageBundleRows';

describe('getRopewikiImageBundleRows (database)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });
    const conn: db.Queryable = pool;
    const regionId = 'f1000004-0004-4000-8000-000000000004';
    const pageId = 'f2000006-0006-4000-8000-000000000006';
    const imageReadyId = 'f3000006-0006-4000-8000-000000000006';
    const imageErrorId = 'f3000007-0007-4000-8000-000000000007';
    const imageDeletedId = 'f3000008-0008-4000-8000-000000000008';
    const imageDataReadyId = 'f4000003-0003-4000-8000-000000000003';
    const imageDataErrorId = 'f4000004-0004-4000-8000-000000000004';
    const imageIds = [imageReadyId, imageErrorId, imageDeletedId];
    const imageDataIds = [imageDataReadyId, imageDataErrorId];

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiImage" WHERE id IN (${db.vals(imageIds)})`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage" WHERE id = ${db.param(pageId)}::uuid`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);
        await db.sql`DELETE FROM "ImageData" WHERE id IN (${db.vals(imageDataIds)})`.run(conn);

        await db
            .insert('ImageData', {
                id: imageDataReadyId,
                sourceUrl: 'https://ropewiki.com/images/bundle-ready.jpg',
                bannerUrl: 'https://cdn.example.com/banner.avif',
                fullUrl: 'https://cdn.example.com/full.avif',
            })
            .run(conn);
        await db
            .insert('ImageData', {
                id: imageDataErrorId,
                sourceUrl: 'https://ropewiki.com/images/bundle-error.jpg',
                errorMessage: 'processing failed',
            })
            .run(conn);
        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegionName: null,
                name: 'Image Bundle Region',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/Image_Bundle_Region',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: 'image-bundle-page',
                name: 'Image Bundle Page',
                region: regionId,
                url: 'https://ropewiki.com/Image_Bundle_Page',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                quality: 1,
                userVotes: 1,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                id: imageReadyId,
                ropewikiPage: pageId,
                betaSection: null,
                processedImage: imageDataReadyId,
                linkUrl: 'https://ropewiki.com/File:bundle-ready.jpg',
                fileUrl: 'https://ropewiki.com/images/bundle-ready.jpg',
                order: 1,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                id: imageErrorId,
                ropewikiPage: pageId,
                betaSection: null,
                processedImage: imageDataErrorId,
                linkUrl: 'https://ropewiki.com/File:bundle-error.jpg',
                fileUrl: 'https://ropewiki.com/images/bundle-error.jpg',
                order: 2,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                id: imageDeletedId,
                ropewikiPage: pageId,
                betaSection: null,
                processedImage: imageDataReadyId,
                linkUrl: 'https://ropewiki.com/File:bundle-deleted.jpg',
                fileUrl: 'https://ropewiki.com/images/bundle-deleted.jpg',
                order: 3,
                deletedAt: new Date(),
            })
            .run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiImage" WHERE id IN (${db.vals(imageIds)})`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage" WHERE id = ${db.param(pageId)}::uuid`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);
        await db.sql`DELETE FROM "ImageData" WHERE id IN (${db.vals(imageDataIds)})`.run(conn);
        await pool.end();
    });

    it('returns processed images without errors, excluding deleted rows', async () => {
        await expect(getRopewikiImageBundleRows(conn, pageId)).resolves.toEqual([
            {
                imageId: imageReadyId,
                processedImageId: imageDataReadyId,
                bannerUrl: 'https://cdn.example.com/banner.avif',
                fullUrl: 'https://cdn.example.com/full.avif',
            },
        ]);
    });
});
