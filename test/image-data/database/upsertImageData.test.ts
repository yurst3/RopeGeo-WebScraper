import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import * as db from 'zapatos/db';
import upsertImageData from '../../../src/image-data/database/upsertImageData';
import ImageData from '../../../src/image-data/types/imageData';

describe('upsertImageData (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;

    beforeAll(async () => {
        await db.sql`DELETE FROM "ImageData"`.run(conn);
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "ImageData"`.run(conn);
    });

    afterAll(async () => {
        await pool.end();
    });

    it('inserts a new ImageData record when id is not provided', async () => {
        const imageData = new ImageData(
            'https://example.com/preview.avif',
            'https://example.com/banner.avif',
            'https://example.com/full.avif',
            'https://example.com/lossless.avif',
            'https://example.com/source.jpg',
        );

        const result = await upsertImageData(conn, imageData);

        expect(result).toBeInstanceOf(ImageData);
        expect(result.id).toBeDefined();
        expect(result.previewUrl).toBe('https://example.com/preview.avif');
        expect(result.bannerUrl).toBe('https://example.com/banner.avif');
        expect(result.fullUrl).toBe('https://example.com/full.avif');
        expect(result.losslessUrl).toBe('https://example.com/lossless.avif');
        expect(result.sourceUrl).toBe('https://example.com/source.jpg');
        expect(result.errorMessage).toBeUndefined();

        const resultId = result.id;
        if (!resultId) throw new Error('Result id is undefined');
        const dbRow = await db.selectOne('ImageData', { id: resultId }).run(conn);
        expect(dbRow).toBeDefined();
        expect(dbRow!.previewUrl).toBe('https://example.com/preview.avif');
        expect(dbRow!.fullUrl).toBe('https://example.com/full.avif');
        expect(dbRow!.losslessUrl).toBe('https://example.com/lossless.avif');
        expect(dbRow!.sourceUrl).toBe('https://example.com/source.jpg');
    });

    it('inserts a new ImageData record when id is provided', async () => {
        const imageDataId = '11111111-1111-1111-1111-111111111111';
        const imageData = new ImageData(
            'https://example.com/preview.avif',
            'https://example.com/banner.avif',
            'https://example.com/full.avif',
            'https://example.com/lossless.avif',
            'https://example.com/source.jpg',
            undefined,
            imageDataId,
        );

        const result = await upsertImageData(conn, imageData);

        expect(result).toBeInstanceOf(ImageData);
        expect(result.id).toBe(imageDataId);
        expect(result.previewUrl).toBe('https://example.com/preview.avif');
        expect(result.losslessUrl).toBe('https://example.com/lossless.avif');
        expect(result.sourceUrl).toBe('https://example.com/source.jpg');
    });

    it('updates an existing ImageData record when id is provided', async () => {
        const imageDataId = '11111111-1111-1111-1111-111111111111';
        const initial = new ImageData(
            'https://example.com/old-preview.avif',
            'https://example.com/old-banner.avif',
            'https://example.com/old-full.avif',
            'https://example.com/old-lossless.avif',
            'https://example.com/old-source.jpg',
            undefined,
            imageDataId,
        );
        await upsertImageData(conn, initial);

        await new Promise(resolve => setTimeout(resolve, 10));

        const updated = new ImageData(
            'https://example.com/new-preview.avif',
            'https://example.com/new-banner.avif',
            'https://example.com/new-full.avif',
            'https://example.com/new-lossless.avif',
            'https://example.com/new-source.jpg',
            undefined,
            imageDataId,
        );
        const result = await upsertImageData(conn, updated);

        expect(result.id).toBe(imageDataId);
        expect(result.previewUrl).toBe('https://example.com/new-preview.avif');
        expect(result.bannerUrl).toBe('https://example.com/new-banner.avif');
        expect(result.fullUrl).toBe('https://example.com/new-full.avif');
        expect(result.losslessUrl).toBe('https://example.com/new-lossless.avif');
        expect(result.sourceUrl).toBe('https://example.com/new-source.jpg');

        const dbRow = await db.selectOne('ImageData', { id: imageDataId }).run(conn);
        expect(dbRow!.previewUrl).toBe('https://example.com/new-preview.avif');
        expect(dbRow!.losslessUrl).toBe('https://example.com/new-lossless.avif');
        expect(dbRow!.sourceUrl).toBe('https://example.com/new-source.jpg');
    });

    it('returns existing row and logs warning when allowUpdates is false (does not update)', async () => {
        const imageDataId = '22222222-2222-2222-2222-222222222222';
        const initial = new ImageData(
            'https://example.com/original-preview.avif',
            'https://example.com/original-banner.avif',
            'https://example.com/original-full.avif',
            'https://example.com/original-lossless.avif',
            'https://example.com/original-source.jpg',
            undefined,
            imageDataId,
        );
        await upsertImageData(conn, initial);

        await db.sql`
            UPDATE "ImageData"
            SET "allowUpdates" = false
            WHERE id = ${db.param(imageDataId)}::uuid
        `.run(conn);

        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const updated = new ImageData(
            'https://example.com/should-not-apply.avif',
            'https://example.com/should-not-apply.avif',
            'https://example.com/should-not-apply.avif',
            'https://example.com/should-not-apply.avif',
            'https://example.com/should-not-apply.jpg',
            undefined,
            imageDataId,
        );
        const result = await upsertImageData(conn, updated);

        expect(result.id).toBe(imageDataId);
        expect(result.previewUrl).toBe('https://example.com/original-preview.avif');
        expect(result.losslessUrl).toBe('https://example.com/original-lossless.avif');
        expect(result.sourceUrl).toBe('https://example.com/original-source.jpg');
        expect(warnSpy).toHaveBeenCalledWith(
            `ImageData row ${imageDataId} not updated: allowUpdates is false`,
        );
        warnSpy.mockRestore();

        const dbRow = await db.selectOne('ImageData', { id: imageDataId }).run(conn);
        expect(dbRow!.previewUrl).toBe('https://example.com/original-preview.avif');
    });
});
