import { Pool } from 'pg';
import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { describe, it, expect, afterEach, beforeAll, afterAll } from '@jest/globals';
import upsertImages from '../../database/upsertImages';
import type { RopewikiImage } from '../../types/ropewiki';
import RopewikiPageInfo from '../../types/ropewiki';
import upsertPages from '../../database/upsertPages';
import upsertBetaSections from '../../database/upsertBetaSections';
import type { RopewikiBetaSection } from '../../types/ropewiki';

describe('upsertImages (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;
    const testRegionId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
    const regionNameIds: {[name: string]: string} = { 'Test Region': testRegionId };
    let testPageUuid: string;
    let betaTitleIds: { [title: string]: string };

    beforeAll(async () => {
        // Clean tables
        await db.sql`DELETE FROM "RopewikiImage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPageBetaSection"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);

        // Insert a test region (required foreign key)
        await db
            .insert('RopewikiRegion', {
                id: testRegionId,
                parentRegion: null,
                name: 'Test Region',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);

        // Insert a test page (required foreign key for images)
        const latestRevisionDate = new Date('2025-01-01T00:00:00Z');
        const pageInfo = new RopewikiPageInfo({
            printouts: {
                pageid: ['9999'],
                name: ['Test Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Test_Page'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-01T00:00:00Z' }],
            },
        }, regionNameIds);
        const results = await upsertPages(conn, [pageInfo], regionNameIds);
        testPageUuid = results[0].id;

        // Insert test beta sections to get betaTitleIds
        const betaSections: RopewikiBetaSection[] = [
            { title: 'Introduction', text: 'Introduction text.', order: 1 },
            { title: 'Approach', text: 'Approach text.', order: 2 },
        ];
        betaTitleIds = await upsertBetaSections(conn, testPageUuid, betaSections, new Date('2025-01-01T00:00:00Z'));
    });

    afterEach(async () => {
        // Clean between tests
        await db.sql`DELETE FROM "RopewikiImage"`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiImage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPageBetaSection"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
        await pool.end();
    });

    it('returns empty array when images array is empty', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        const images: RopewikiImage[] = [];

        const result = await upsertImages(conn, testPageUuid, images, betaTitleIds, latestRevisionDate);

        expect(result).toEqual([]);

        const rows = await db.select('RopewikiImage', {}).run(conn);
        expect(rows).toHaveLength(0);
    });

    it('inserts net new images and returns their IDs', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        const images: RopewikiImage[] = [
            {
                betaSectionTitle: 'Introduction',
                linkUrl: 'https://ropewiki.com/Image1',
                fileUrl: 'https://ropewiki.com/files/Image1.jpg',
                caption: 'Image 1 caption',
                order: 1,
            },
            {
                betaSectionTitle: 'Approach',
                linkUrl: 'https://ropewiki.com/Image2',
                fileUrl: 'https://ropewiki.com/files/Image2.jpg',
                caption: 'Image 2 caption',
                order: 1,
            },
            {
                betaSectionTitle: undefined,
                linkUrl: 'https://ropewiki.com/Image3',
                fileUrl: 'https://ropewiki.com/files/Image3.jpg',
                caption: 'Image 3 caption',
                order: 1,
            },
        ];

        const result = await upsertImages(conn, testPageUuid, images, betaTitleIds, latestRevisionDate);

        // Verify all IDs were returned
        expect(result).toHaveLength(3);
        expect(result.every(id => typeof id === 'string')).toBe(true);
        expect(result.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))).toBe(true);
        // Verify all IDs are unique
        expect(new Set(result).size).toBe(3);

        const rows = await db
            .select('RopewikiImage', { ropewikiPage: testPageUuid })
            .run(conn);
        expect(rows).toHaveLength(3);

        const image1 = rows.find((r) => r.fileUrl === 'https://ropewiki.com/files/Image1.jpg') as s.RopewikiImage.JSONSelectable;
        const image2 = rows.find((r) => r.fileUrl === 'https://ropewiki.com/files/Image2.jpg') as s.RopewikiImage.JSONSelectable;
        const image3 = rows.find((r) => r.fileUrl === 'https://ropewiki.com/files/Image3.jpg') as s.RopewikiImage.JSONSelectable;

        // Verify returned IDs match database IDs
        expect(result).toContain(image1.id);
        expect(result).toContain(image2.id);
        expect(result).toContain(image3.id);

        expect(image1.betaSection).toBe(betaTitleIds.Introduction);
        expect(image1.linkUrl).toBe('https://ropewiki.com/Image1');
        expect(image1.fileUrl).toBe('https://ropewiki.com/files/Image1.jpg');
        expect(image1.caption).toBe('Image 1 caption');
        expect(image1.order).toBe(1);
        expect(new Date(image1.latestRevisionDate).toISOString()).toBe(latestRevisionDate.toISOString());

        expect(image2.betaSection).toBe(betaTitleIds.Approach);
        expect(image2.linkUrl).toBe('https://ropewiki.com/Image2');
        expect(image2.fileUrl).toBe('https://ropewiki.com/files/Image2.jpg');
        expect(image2.caption).toBe('Image 2 caption');
        expect(image2.order).toBe(1);
        expect(new Date(image2.latestRevisionDate).toISOString()).toBe(latestRevisionDate.toISOString());

        expect(image3.betaSection).toBeNull();
        expect(image3.linkUrl).toBe('https://ropewiki.com/Image3');
        expect(image3.fileUrl).toBe('https://ropewiki.com/files/Image3.jpg');
        expect(image3.caption).toBe('Image 3 caption');
        expect(image3.order).toBe(1);
        expect(new Date(image3.latestRevisionDate).toISOString()).toBe(latestRevisionDate.toISOString());
    });

    it('updates existing images via upsert and returns their IDs', async () => {
        const initialRevisionDate = new Date('2025-01-01T00:00:00Z');
        const updatedRevisionDate = new Date('2025-01-03T14:20:10Z');

        // First, insert images
        const initialImages: RopewikiImage[] = [
            {
                betaSectionTitle: 'Introduction',
                linkUrl: 'https://ropewiki.com/Image1',
                fileUrl: 'https://ropewiki.com/files/Image1.jpg',
                caption: 'Initial caption 1',
                order: 1,
            },
            {
                betaSectionTitle: undefined,
                linkUrl: 'https://ropewiki.com/Image2',
                fileUrl: 'https://ropewiki.com/files/Image2.jpg',
                caption: 'Initial caption 2',
                order: 1,
            },
        ];

        const initialResult = await upsertImages(conn, testPageUuid, initialImages, betaTitleIds, initialRevisionDate);

        // Verify the initial insert returned IDs
        expect(initialResult).toHaveLength(2);
        expect(initialResult.every(id => typeof id === 'string')).toBe(true);

        // Verify the images were inserted
        const initialRows = await db
            .select('RopewikiImage', { ropewikiPage: testPageUuid })
            .run(conn);
        expect(initialRows).toHaveLength(2);
        expect(initialResult).toContain(initialRows[0]?.id);
        expect(initialResult).toContain(initialRows[1]?.id);

        // Now update the same images with new data
        const updatedImages: RopewikiImage[] = [
            {
                betaSectionTitle: 'Introduction',
                linkUrl: 'https://ropewiki.com/Image1_Updated',
                fileUrl: 'https://ropewiki.com/files/Image1.jpg', // Same fileUrl (conflict key)
                caption: 'Updated caption 1',
                order: 2,
            },
            {
                betaSectionTitle: undefined,
                linkUrl: 'https://ropewiki.com/Image2_Updated',
                fileUrl: 'https://ropewiki.com/files/Image2.jpg', // Same fileUrl (conflict key)
                caption: 'Updated caption 2',
                order: 2,
            },
        ];

        const updatedResult = await upsertImages(conn, testPageUuid, updatedImages, betaTitleIds, updatedRevisionDate);

        // Verify the update returned IDs (should be the same IDs)
        expect(updatedResult).toHaveLength(2);
        expect(updatedResult.every(id => typeof id === 'string')).toBe(true);
        // The IDs should match the initial IDs since we're updating the same images
        expect(updatedResult.sort()).toEqual(initialResult.sort());

        // Verify the images were updated
        const updatedRows = await db
            .select('RopewikiImage', { ropewikiPage: testPageUuid })
            .run(conn);
        expect(updatedRows).toHaveLength(2);

        const image1 = updatedRows.find((r) => r.fileUrl === 'https://ropewiki.com/files/Image1.jpg') as s.RopewikiImage.JSONSelectable;
        const image2 = updatedRows.find((r) => r.fileUrl === 'https://ropewiki.com/files/Image2.jpg') as s.RopewikiImage.JSONSelectable;

        // Verify returned IDs match database IDs
        expect(updatedResult).toContain(image1.id);
        expect(updatedResult).toContain(image2.id);

        expect(image1.betaSection).toBe(betaTitleIds.Introduction);
        expect(image1.linkUrl).toBe('https://ropewiki.com/Image1_Updated');
        expect(image1.caption).toBe('Updated caption 1');
        expect(image1.order).toBe(2);
        expect(new Date(image1.latestRevisionDate).toISOString()).toBe(updatedRevisionDate.toISOString());

        expect(image2.betaSection).toBeNull();
        expect(image2.linkUrl).toBe('https://ropewiki.com/Image2_Updated');
        expect(image2.caption).toBe('Updated caption 2');
        expect(image2.order).toBe(2);
        expect(new Date(image2.latestRevisionDate).toISOString()).toBe(updatedRevisionDate.toISOString());
    });

    it('throws an error when betaSectionTitle is provided but not found in betaTitleIds', async () => {
        const latestRevisionDate = new Date('2025-01-04T10:00:00Z');
        const images: RopewikiImage[] = [
            {
                betaSectionTitle: 'NonExistentSection',
                linkUrl: 'https://ropewiki.com/Image1',
                fileUrl: 'https://ropewiki.com/files/Image1.jpg',
                caption: 'Image 1 caption',
                order: 1,
            },
        ];

        await expect(
            upsertImages(conn, testPageUuid, images, betaTitleIds, latestRevisionDate)
        ).rejects.toThrow('No id given for NonExistentSection title');
    });

    it('sets deletedAt to null when upserting', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        const images: RopewikiImage[] = [
            {
                betaSectionTitle: 'Introduction',
                linkUrl: 'https://ropewiki.com/DeletedImage',
                fileUrl: 'https://ropewiki.com/files/DeletedImage.jpg',
                caption: 'Deleted image caption',
                order: 1,
            },
        ];

        // Insert an image with deletedAt set
        await db
            .insert('RopewikiImage', {
                ropewikiPage: testPageUuid,
                betaSection: betaTitleIds.Introduction ?? null,
                linkUrl: 'https://ropewiki.com/DeletedImage',
                fileUrl: 'https://ropewiki.com/files/DeletedImage.jpg',
                caption: 'Deleted image caption',
                order: 1,
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                deletedAt: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);

        // Get the inserted image ID
        const insertedRows = await db.select('RopewikiImage', { fileUrl: 'https://ropewiki.com/files/DeletedImage.jpg', ropewikiPage: testPageUuid }).run(conn);
        const imageId = insertedRows[0]?.id as string;

        // Verify deletedAt is set
        const beforeRows = await db.select('RopewikiImage', { id: imageId }).run(conn);
        expect(beforeRows[0]?.deletedAt).not.toBeNull();

        // Upsert the image
        await upsertImages(conn, testPageUuid, images, betaTitleIds, latestRevisionDate);

        // Verify deletedAt is now null
        const afterRows = await db.select('RopewikiImage', { id: imageId }).run(conn);
        expect(afterRows).toHaveLength(1);
        const image = afterRows[0] as s.RopewikiImage.JSONSelectable;
        expect(image.deletedAt).toBeNull();
        expect(image.caption).toBe('Deleted image caption');
    });

    it('throws an error when attempting to insert duplicate order for the same page and betaSection', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        const images: RopewikiImage[] = [
            {
                betaSectionTitle: 'Introduction',
                linkUrl: 'https://ropewiki.com/Image1',
                fileUrl: 'https://ropewiki.com/files/Image1.jpg',
                caption: 'Image 1 caption',
                order: 1,
            },
            {
                betaSectionTitle: 'Introduction',
                linkUrl: 'https://ropewiki.com/Image2',
                fileUrl: 'https://ropewiki.com/files/Image2.jpg',
                caption: 'Image 2 caption',
                order: 1, // Same order and betaSection as Image1
            },
        ];

        await expect(
            upsertImages(conn, testPageUuid, images, betaTitleIds, latestRevisionDate)
        ).rejects.toThrow();
    });

    it('allows same order for different betaSections', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        const images: RopewikiImage[] = [
            {
                betaSectionTitle: 'Introduction',
                linkUrl: 'https://ropewiki.com/Image1',
                fileUrl: 'https://ropewiki.com/files/Image1.jpg',
                caption: 'Image 1 caption',
                order: 1,
            },
            {
                betaSectionTitle: 'Approach',
                linkUrl: 'https://ropewiki.com/Image2',
                fileUrl: 'https://ropewiki.com/files/Image2.jpg',
                caption: 'Image 2 caption',
                order: 1, // Same order but different betaSection - should be allowed
            },
        ];

        const result = await upsertImages(conn, testPageUuid, images, betaTitleIds, latestRevisionDate);
        expect(result).toHaveLength(2);
    });

    it('allows same order for images without betaSection', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        const images: RopewikiImage[] = [
            {
                betaSectionTitle: undefined,
                linkUrl: 'https://ropewiki.com/Image1',
                fileUrl: 'https://ropewiki.com/files/Image1.jpg',
                caption: 'Image 1 caption',
                order: 1,
            },
            {
                betaSectionTitle: undefined,
                linkUrl: 'https://ropewiki.com/Image2',
                fileUrl: 'https://ropewiki.com/files/Image2.jpg',
                caption: 'Image 2 caption',
                order: 1, // Same order and betaSection (both null) - should throw
            },
        ];

        await expect(
            upsertImages(conn, testPageUuid, images, betaTitleIds, latestRevisionDate)
        ).rejects.toThrow();
    });

    it('updates order when upserting existing image', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // First insert with order 1
        const initialImages: RopewikiImage[] = [
            {
                betaSectionTitle: 'Introduction',
                linkUrl: 'https://ropewiki.com/Image1',
                fileUrl: 'https://ropewiki.com/files/Image1.jpg',
                caption: 'Initial caption',
                order: 1,
            },
        ];
        await upsertImages(conn, testPageUuid, initialImages, betaTitleIds, latestRevisionDate);

        // Update with order 2
        const updatedImages: RopewikiImage[] = [
            {
                betaSectionTitle: 'Introduction',
                linkUrl: 'https://ropewiki.com/Image1_Updated',
                fileUrl: 'https://ropewiki.com/files/Image1.jpg', // Same fileUrl (conflict key)
                caption: 'Updated caption',
                order: 2,
            },
        ];
        await upsertImages(conn, testPageUuid, updatedImages, betaTitleIds, latestRevisionDate);

        // Verify order was updated
        const rows = await db
            .select('RopewikiImage', { ropewikiPage: testPageUuid, fileUrl: 'https://ropewiki.com/files/Image1.jpg' })
            .run(conn);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.order).toBe(2);
        expect(rows[0]?.caption).toBe('Updated caption');
    });

    it('propagates errors from the database layer', async () => {
        const latestRevisionDate = new Date('2025-01-04T10:00:00Z');
        const images: RopewikiImage[] = [
            {
                betaSectionTitle: 'Introduction',
                linkUrl: 'https://ropewiki.com/Image1',
                fileUrl: 'https://ropewiki.com/files/Image1.jpg',
                caption: 'Image 1 caption',
                order: 1,
            },
        ];

        // Use a client with a non-existent database to force an error
        const badPool = new Pool({
            user: process.env.TEST_USER,
            password: process.env.TEST_PASS,
            host: process.env.TEST_HOST,
            port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
            database: 'nonexistent_database_for_test_error_upsert_images',
        });

        await expect(upsertImages(badPool, testPageUuid, images, betaTitleIds, latestRevisionDate)).rejects.toBeDefined();

        await badPool.end();
    });
});

