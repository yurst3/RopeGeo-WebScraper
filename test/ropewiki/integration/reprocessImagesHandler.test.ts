import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import * as db from 'zapatos/db';
import sendImageProcessorSQSMessage from '../../../src/image-data/sqs/sendImageProcessorSQSMessage';
import { ImageDataEvent } from '../../../src/image-data/types/lambdaEvent';
import getRopewikiImagesToProcess from '../../../src/ropewiki/database/getRopewikiImagesToProcess';
import { reprocessImagesHandler } from '../../../src/ropewiki/lambda-handlers/reprocessImagesHandler';

jest.mock('../../../src/image-data/sqs/sendImageProcessorSQSMessage', () => {
    const actual = jest.requireActual<
        typeof import('../../../src/image-data/sqs/sendImageProcessorSQSMessage')
    >('../../../src/image-data/sqs/sendImageProcessorSQSMessage');
    return {
        __esModule: true,
        serializeImageDataEventForQueue: actual.serializeImageDataEventForQueue,
        default: jest.fn(async () => {}),
    };
});

const mockSendImageProcessorSQSMessage = jest.mocked(sendImageProcessorSQSMessage);

/**
 * Integration: real DB (TEST_* / DB_*), real getRopewikiImagesToProcess; SQS mocked.
 */
describe('reprocessImagesHandler (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;
    const regionId = 'f1000001-0001-4000-8000-000000000001';
    const pageId = 'f2000001-0001-4000-8000-000000000001';
    const imageDataA = 'f4000001-0001-4000-8000-000000000001';
    const imageDataB = 'f4000002-0002-4000-8000-000000000002';
    const imageA = 'f3000001-0001-4000-8000-000000000001';
    const imageB = 'f3000002-0002-4000-8000-000000000002';
    const imageCUnprocessed = 'f3000003-0003-4000-8000-000000000003';

    beforeAll(async () => {
        process.env.DB_HOST = process.env.TEST_HOST ?? '127.0.0.1';
        process.env.DB_PORT = process.env.TEST_PORT ?? '8080';
        process.env.DB_NAME = process.env.TEST_DB ?? 'test';
        process.env.DB_USER = process.env.TEST_USER ?? 'testUser';
        process.env.DB_PASSWORD = process.env.TEST_PASS ?? 'testPass';
        delete process.env.DEV_ENVIRONMENT;

        await db.sql`DELETE FROM "RopewikiImage" WHERE id IN (${db.vals([imageA, imageB, imageCUnprocessed])})`.run(
            conn,
        );
        await db.sql`DELETE FROM "RopewikiPage" WHERE id = ${db.param(pageId)}`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}`.run(conn);
        await db.sql`DELETE FROM "ImageData" WHERE id IN (${db.vals([imageDataA, imageDataB])})`.run(conn);

        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegionName: null,
                name: 'ReprocessHandlerIntRegion',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/ReprocessHandlerIntRegion',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: 'reprocess-int-page',
                name: 'Reprocess Int Page',
                region: regionId,
                url: 'https://ropewiki.com/Reprocess_Int_Page',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                quality: 1,
                userVotes: 1,
            })
            .run(conn);

        await db
            .insert('ImageData', {
                id: imageDataA,
                sourceUrl: 'https://ropewiki.com/images/a.jpg',
                losslessUrl: 'https://api.example.com/a-lossless.avif',
            })
            .run(conn);
        await db
            .insert('ImageData', {
                id: imageDataB,
                sourceUrl: 'https://ropewiki.com/images/b.jpg',
                losslessUrl: 'https://api.example.com/b-lossless.avif',
            })
            .run(conn);

        await db
            .insert('RopewikiImage', {
                id: imageA,
                ropewikiPage: pageId,
                betaSection: null,
                processedImage: imageDataA,
                linkUrl: 'https://ropewiki.com/File:a.jpg',
                fileUrl: 'https://ropewiki.com/images/a.jpg',
                order: 1,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                id: imageB,
                ropewikiPage: pageId,
                betaSection: null,
                processedImage: imageDataB,
                linkUrl: 'https://ropewiki.com/File:b.jpg',
                fileUrl: 'https://ropewiki.com/images/b.jpg',
                order: 2,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                id: imageCUnprocessed,
                ropewikiPage: pageId,
                betaSection: null,
                linkUrl: 'https://ropewiki.com/File:c.jpg',
                fileUrl: 'https://ropewiki.com/images/c.jpg',
                order: 3,
            })
            .run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiImage" WHERE id IN (${db.vals([imageA, imageB, imageCUnprocessed])})`.run(
            conn,
        );
        await db.sql`DELETE FROM "RopewikiPage" WHERE id = ${db.param(pageId)}`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}`.run(conn);
        await db.sql`DELETE FROM "ImageData" WHERE id IN (${db.vals([imageDataA, imageDataB])})`.run(conn);
        await pool.end();
    });

    beforeEach(() => {
        mockSendImageProcessorSQSMessage.mockClear();
    });

    it('with downloadSource false and onlyUnprocessed false, enqueues every RopewikiImage row selected by getRopewikiImagesToProcess (same count and ids)', async () => {
        const countClient = await pool.connect();
        let expected;
        try {
            expected = await getRopewikiImagesToProcess(countClient, false, false);
        } finally {
            countClient.release();
        }

        const ids = new Set(expected.map((r) => r.id));
        expect(ids.has(imageA)).toBe(true);
        expect(ids.has(imageB)).toBe(true);
        expect(ids.has(imageCUnprocessed)).toBe(false);

        const result = await reprocessImagesHandler({
            body: JSON.stringify({ downloadSource: false, onlyUnprocessed: false }),
        });

        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body) as { enqueuedCount: number };
        expect(body.enqueuedCount).toBe(expected.length);
        expect(mockSendImageProcessorSQSMessage).toHaveBeenCalledTimes(expected.length);

        const calledIds = new Set(
            mockSendImageProcessorSQSMessage.mock.calls.map((c) => (c[0] as ImageDataEvent).pageImageId),
        );
        for (const img of expected) {
            expect(img.id).toBeDefined();
            expect(calledIds.has(img.id as string)).toBe(true);
            expect(
                mockSendImageProcessorSQSMessage,
            ).toHaveBeenCalledWith(img.toImageDataEvent(false, undefined));
        }
    });
});
