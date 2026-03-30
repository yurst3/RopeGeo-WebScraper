import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import { ImageVersion } from 'ropegeo-common';
import getImageDataMetadataById from '../../../src/image-data/database/getImageDataMetadataById';
import { Metadata, Orientation } from '../../../src/image-data/types/metadata';

describe('getImageDataMetadataById (integration)', () => {
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

    it('returns null when no row exists for the id', async () => {
        const id = '22222222-2222-2222-2222-222222222222';
        const result = await getImageDataMetadataById(conn, id);
        expect(result).toBeNull();
    });

    it('returns null when the row exists but metadata is null', async () => {
        const id = '33333333-3333-3333-3333-333333333333';
        await db.insert('ImageData', { id, metadata: null }).run(conn);

        const result = await getImageDataMetadataById(conn, id);
        expect(result).toBeNull();
    });

    it('returns Metadata parsed from jsonb when metadata is set', async () => {
        const id = '44444444-4444-4444-4444-444444444444';
        const stored = {
            [ImageVersion.preview]: {
                sizeKB: 1.25,
                dimensions: { width: 64, height: 48 },
                orientation: Orientation.Normal,
                mimeType: 'image/avif',
            },
            source: {
                sizeKB: 80,
                dimensions: { width: 1920, height: 1080 },
                orientation: Orientation.Rotated90CW,
                mimeType: 'image/jpeg',
            },
        };
        await db.insert('ImageData', { id, metadata: stored }).run(conn);

        const result = await getImageDataMetadataById(conn, id);

        expect(result).toBeInstanceOf(Metadata);
        const expected = new Metadata(
            {
                [ImageVersion.preview]: {
                    sizeKB: 1.25,
                    dimensions: { width: 64, height: 48 },
                    orientation: Orientation.Normal,
                    mimeType: 'image/avif',
                },
            },
            {
                sizeKB: 80,
                dimensions: { width: 1920, height: 1080 },
                orientation: Orientation.Rotated90CW,
                mimeType: 'image/jpeg',
            },
        );
        expect(result!.toJSON()).toEqual(expected.toJSON());
    });
});
