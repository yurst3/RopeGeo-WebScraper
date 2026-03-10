import { Pool } from 'pg';
import * as db from 'zapatos/db';
import { describe, it, expect, afterAll, beforeAll } from '@jest/globals';
import updateProcessedImage from '../../../src/ropewiki/database/updateProcessedImage';

describe('updateProcessedImage (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;
    const testRegionId = 'a1000001-0001-4000-8000-000000000001';
    const testPageId = 'b1000001-0001-4000-8000-000000000001';
    const testImageId = 'c1000001-0001-4000-8000-000000000001';
    const testImageDataId = 'd1000001-0001-4000-8000-000000000001';
    const otherImageDataId = 'd1000002-0002-4000-8000-000000000002';

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiImage" WHERE id = ${db.param(testImageId)}`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage" WHERE id = ${db.param(testPageId)}`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(testRegionId)}`.run(conn);
        await db.sql`DELETE FROM "ImageData" WHERE id IN (${db.param(testImageDataId)}, ${db.param(otherImageDataId)})`.run(conn);

        await db.insert('ImageData', { id: testImageDataId }).run(conn);
        await db.insert('ImageData', { id: otherImageDataId }).run(conn);
        await db
            .insert('RopewikiRegion', {
                id: testRegionId,
                parentRegionName: null,
                name: 'UpdateProcessedImageRegion',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/UpdateProcessedImageRegion',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: testPageId,
                pageId: 'update-processed-image-page-1',
                name: 'Update Processed Image Page',
                region: testRegionId,
                url: 'https://ropewiki.com/Update_Processed_Image_Page',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                quality: 1,
                userVotes: 1,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                id: testImageId,
                ropewikiPage: testPageId,
                betaSection: null,
                linkUrl: 'https://ropewiki.com/File:test.jpg',
                fileUrl: 'https://ropewiki.com/images/test.jpg',
                order: 1,
            })
            .run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiImage" WHERE id = ${db.param(testImageId)}`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage" WHERE id = ${db.param(testPageId)}`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(testRegionId)}`.run(conn);
        await db.sql`DELETE FROM "ImageData" WHERE id IN (${db.param(testImageDataId)}, ${db.param(otherImageDataId)})`.run(conn);
        await pool.end();
    });

    it('sets processedImage on the RopewikiImage row', async () => {
        const rowBefore = await db.selectOne('RopewikiImage', { id: testImageId }).run(conn);
        expect(rowBefore?.processedImage).toBeNull();

        await updateProcessedImage(conn, testImageId, testImageDataId);

        const rowAfter = await db.selectOne('RopewikiImage', { id: testImageId }).run(conn);
        expect(rowAfter?.processedImage).toBe(testImageDataId);
    });

    it('overwrites existing processedImage when called again', async () => {
        await updateProcessedImage(conn, testImageId, otherImageDataId);

        const row = await db.selectOne('RopewikiImage', { id: testImageId }).run(conn);
        expect(row?.processedImage).toBe(otherImageDataId);

        await updateProcessedImage(conn, testImageId, testImageDataId);
        const rowRestored = await db.selectOne('RopewikiImage', { id: testImageId }).run(conn);
        expect(rowRestored?.processedImage).toBe(testImageDataId);
    });
});
