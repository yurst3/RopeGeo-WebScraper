import { Pool } from 'pg';
import * as db from 'zapatos/db';
import { describe, it, expect, afterAll, beforeAll } from '@jest/globals';
import getRopewikiImagesToProcess from '../../../src/ropewiki/database/getRopewikiImagesToProcess';
import { RopewikiImage } from '../../../src/ropewiki/types/image';

describe('getRopewikiImagesToProcess (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;
    const testRegionId = 'e1000001-0001-4000-8000-000000000001';
    const testPageId = 'e2000001-0001-4000-8000-000000000001';
    const imageNoProcessedId = 'e3000001-0001-4000-8000-000000000001';
    const imageSourceMismatchId = 'e3000002-0002-4000-8000-000000000002';
    const imageSourceMatchId = 'e3000003-0003-4000-8000-000000000003';
    const imageDeletedId = 'e3000004-0004-4000-8000-000000000004';
    const imageDataId = 'e4000001-0001-4000-8000-000000000001';

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiImage" WHERE id IN (${db.param(imageNoProcessedId)}, ${db.param(imageSourceMismatchId)}, ${db.param(imageSourceMatchId)}, ${db.param(imageDeletedId)})`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage" WHERE id = ${db.param(testPageId)}`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(testRegionId)}`.run(conn);
        await db.sql`DELETE FROM "ImageData" WHERE id = ${db.param(imageDataId)}`.run(conn);

        await db.insert('ImageData', { id: imageDataId, sourceUrl: 'https://ropewiki.com/images/old.jpg' }).run(conn);
        await db
            .insert('RopewikiRegion', {
                id: testRegionId,
                parentRegionName: null,
                name: 'GetRopewikiImagesToProcessRegion',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/GetRopewikiImagesToProcessRegion',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: testPageId,
                pageId: 'get-images-to-process-page-1',
                name: 'Get Images To Process Page',
                region: testRegionId,
                url: 'https://ropewiki.com/Get_Images_To_Process_Page',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                quality: 1,
                userVotes: 1,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                id: imageNoProcessedId,
                ropewikiPage: testPageId,
                betaSection: null,
                linkUrl: 'https://ropewiki.com/File:no-processed.jpg',
                fileUrl: 'https://ropewiki.com/images/no-processed.jpg',
                order: 1,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                id: imageSourceMismatchId,
                ropewikiPage: testPageId,
                betaSection: null,
                processedImage: imageDataId,
                linkUrl: 'https://ropewiki.com/File:current.jpg',
                fileUrl: 'https://ropewiki.com/images/current.jpg',
                order: 2,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                id: imageSourceMatchId,
                ropewikiPage: testPageId,
                betaSection: null,
                processedImage: imageDataId,
                linkUrl: 'https://ropewiki.com/File:old.jpg',
                fileUrl: 'https://ropewiki.com/images/old.jpg',
                order: 3,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                id: imageDeletedId,
                ropewikiPage: testPageId,
                betaSection: null,
                linkUrl: 'https://ropewiki.com/File:deleted.jpg',
                fileUrl: 'https://ropewiki.com/images/deleted.jpg',
                order: 4,
                deletedAt: new Date(),
            })
            .run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiImage" WHERE id IN (${db.param(imageNoProcessedId)}, ${db.param(imageSourceMismatchId)}, ${db.param(imageSourceMatchId)}, ${db.param(imageDeletedId)})`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage" WHERE id = ${db.param(testPageId)}`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(testRegionId)}`.run(conn);
        await db.sql`DELETE FROM "ImageData" WHERE id = ${db.param(imageDataId)}`.run(conn);
        await pool.end();
    });

    it('when onlyUnprocessed is true (default), returns only images with no processedImage', async () => {
        const result = await getRopewikiImagesToProcess(conn);
        expect(result.every((r) => r instanceof RopewikiImage)).toBe(true);
        const ids = result.map((r) => r.id);
        expect(ids).toContain(imageNoProcessedId);
        expect(ids).not.toContain(imageSourceMismatchId);
    });

    it('when downloadSource is false and onlyUnprocessed is true, returns no rows', async () => {
        const result = await getRopewikiImagesToProcess(conn, true, false);
        expect(result).toEqual([]);
    });

    it('when downloadSource is false and onlyUnprocessed is false, returns only processed images with source mismatch', async () => {
        const result = await getRopewikiImagesToProcess(conn, false, false);
        const ids = result.map((r) => r.id);
        expect(ids).toEqual([imageSourceMismatchId]);
        expect(ids).not.toContain(imageNoProcessedId);
        expect(ids).not.toContain(imageSourceMatchId);
    });

    it('when onlyUnprocessed is false, returns images with no processedImage', async () => {
        const result = await getRopewikiImagesToProcess(conn, false);
        const ids = result.map((r) => r.id);
        expect(ids).toContain(imageNoProcessedId);
    });

    it('when onlyUnprocessed is false, returns images where ImageData.sourceUrl differs from fileUrl', async () => {
        const result = await getRopewikiImagesToProcess(conn, false);
        const ids = result.map((r) => r.id);
        expect(ids).toContain(imageSourceMismatchId);
    });

    it('when onlyUnprocessed is false, does not return images where sourceUrl equals fileUrl', async () => {
        const result = await getRopewikiImagesToProcess(conn, false);
        const ids = result.map((r) => r.id);
        expect(ids).not.toContain(imageSourceMatchId);
    });

    it('does not return soft-deleted images', async () => {
        const result = await getRopewikiImagesToProcess(conn, false);
        const ids = result.map((r) => r.id);
        expect(ids).not.toContain(imageDeletedId);
    });

    it('returns RopewikiImage instances with id, fileUrl, and processedImage for each row', async () => {
        const result = await getRopewikiImagesToProcess(conn, false);
        const byId = new Map(result.map((r) => [r.id, r]));
        const noProcessed = byId.get(imageNoProcessedId);
        const mismatch = byId.get(imageSourceMismatchId);
        expect(noProcessed).toBeInstanceOf(RopewikiImage);
        expect(noProcessed!.id).toBe(imageNoProcessedId);
        expect(noProcessed!.fileUrl).toBe('https://ropewiki.com/images/no-processed.jpg');
        expect(noProcessed!.processedImage).toBeNull();
        expect(mismatch).toBeInstanceOf(RopewikiImage);
        expect(mismatch!.id).toBe(imageSourceMismatchId);
        expect(mismatch!.fileUrl).toBe('https://ropewiki.com/images/current.jpg');
        expect(mismatch!.processedImage).toBe(imageDataId);
    });
});
