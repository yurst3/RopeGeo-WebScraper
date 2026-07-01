import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as db from 'zapatos/db';
import { countUnprocessedRopewikiImagesForPage } from '../../../../src/fargate-tasks/buildDownloadFolders/database/countUnprocessedRopewikiImagesForPage';

describe('countUnprocessedRopewikiImagesForPage (database)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });
    const conn: db.Queryable = pool;
    const regionId = 'f1000003-0003-4000-8000-000000000003';
    const pageId = 'f2000005-0005-4000-8000-000000000005';
    const imageNoProcessedId = 'f3000002-0002-4000-8000-000000000002';
    const imageWithErrorId = 'f3000003-0003-4000-8000-000000000003';
    const imageReadyId = 'f3000004-0004-4000-8000-000000000004';
    const imageDeletedId = 'f3000005-0005-4000-8000-000000000005';
    const imageDataReadyId = 'f4000001-0001-4000-8000-000000000001';
    const imageDataErrorId = 'f4000002-0002-4000-8000-000000000002';
    const imageIds = [imageNoProcessedId, imageWithErrorId, imageReadyId, imageDeletedId];
    const imageDataIds = [imageDataReadyId, imageDataErrorId];

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiImage" WHERE id IN (${db.vals(imageIds)})`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage" WHERE id = ${db.param(pageId)}::uuid`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);
        await db.sql`DELETE FROM "ImageData" WHERE id IN (${db.vals(imageDataIds)})`.run(conn);

        await db
            .insert('ImageData', {
                id: imageDataReadyId,
                sourceUrl: 'https://ropewiki.com/images/ready.jpg',
                bannerUrl: 'https://cdn.example.com/banner.avif',
                fullUrl: 'https://cdn.example.com/full.avif',
            })
            .run(conn);
        await db
            .insert('ImageData', {
                id: imageDataErrorId,
                sourceUrl: 'https://ropewiki.com/images/error.jpg',
                errorMessage: 'processing failed',
            })
            .run(conn);
        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegionName: null,
                name: 'Unprocessed Images Region',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/Unprocessed_Images_Region',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: 'unprocessed-images-page',
                name: 'Unprocessed Images Page',
                region: regionId,
                url: 'https://ropewiki.com/Unprocessed_Images_Page',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                quality: 1,
                userVotes: 1,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                id: imageNoProcessedId,
                ropewikiPage: pageId,
                betaSection: null,
                linkUrl: 'https://ropewiki.com/File:no-processed.jpg',
                fileUrl: 'https://ropewiki.com/images/no-processed.jpg',
                order: 1,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                id: imageWithErrorId,
                ropewikiPage: pageId,
                betaSection: null,
                processedImage: imageDataErrorId,
                linkUrl: 'https://ropewiki.com/File:error.jpg',
                fileUrl: 'https://ropewiki.com/images/error.jpg',
                order: 2,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                id: imageReadyId,
                ropewikiPage: pageId,
                betaSection: null,
                processedImage: imageDataReadyId,
                linkUrl: 'https://ropewiki.com/File:ready.jpg',
                fileUrl: 'https://ropewiki.com/images/ready.jpg',
                order: 3,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                id: imageDeletedId,
                ropewikiPage: pageId,
                betaSection: null,
                linkUrl: 'https://ropewiki.com/File:deleted.jpg',
                fileUrl: 'https://ropewiki.com/images/deleted.jpg',
                order: 4,
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

    it('counts images missing processed ImageData or with processing errors', async () => {
        await expect(countUnprocessedRopewikiImagesForPage(conn, pageId)).resolves.toBe(2);
    });

    it('returns zero for a page with no images', async () => {
        await expect(
            countUnprocessedRopewikiImagesForPage(conn, '00000000-0000-4000-8000-000000000099'),
        ).resolves.toBe(0);
    });
});
