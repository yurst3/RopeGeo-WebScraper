import { Pool } from 'pg';
import * as db from 'zapatos/db';
import { describe, it, expect, afterEach, beforeAll, afterAll } from '@jest/globals';
import setImagesDeletedAt from '../../../src/ropewiki/database/setImagesDeletedAt';

describe('setImagesDeletedAt (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;
    const testRegionId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
    let testPageUuid: string;

    beforeAll(async () => {
        // Clean tables
        await db.sql`DELETE FROM "RopewikiImage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);

        // Insert a test region (required foreign key)
        await db
            .insert('RopewikiRegion', {
                id: testRegionId,
                parentRegion: null,
                name: 'Test Region',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                pageCount: 0,
                level: 0,
                bestMonths: JSON.stringify([]),
                url: 'https://ropewiki.com/Test_Region',
            })
            .run(conn);

        // Insert a test page (required foreign key for images)
        testPageUuid = '11111111-1111-1111-1111-111111111111';
        await db
            .insert('RopewikiPage', {
                id: testPageUuid,
                pageId: '9999',
                name: 'Test Page',
                region: testRegionId,
                url: 'https://ropewiki.com/Test_Page',
                months: [],
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);
    });

    afterEach(async () => {
        // Clean between tests
        await db.sql`DELETE FROM "RopewikiImage"`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiImage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
        await pool.end();
    });

    it('sets deletedAt for all images when updatedImageIds is empty', async () => {
        const latestRevisionDate = new Date('2025-01-01T00:00:00Z');

        // Insert images directly
        const image1Id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        const image2Id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
        const image3Id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

        await db
            .insert('RopewikiImage', [
                {
                    id: image1Id,
                    ropewikiPage: testPageUuid,
                    fileUrl: 'https://ropewiki.com/files/Image1.jpg',
                    linkUrl: 'https://ropewiki.com/Image1',
                    caption: 'Image 1 caption',
                    order: 1,
                    latestRevisionDate: latestRevisionDate.toISOString() as db.TimestampString,
                },
                {
                    id: image2Id,
                    ropewikiPage: testPageUuid,
                    fileUrl: 'https://ropewiki.com/files/Image2.jpg',
                    linkUrl: 'https://ropewiki.com/Image2',
                    caption: 'Image 2 caption',
                    order: 2,
                    latestRevisionDate: latestRevisionDate.toISOString() as db.TimestampString,
                },
                {
                    id: image3Id,
                    ropewikiPage: testPageUuid,
                    fileUrl: 'https://ropewiki.com/files/Image3.jpg',
                    linkUrl: 'https://ropewiki.com/Image3',
                    caption: 'Image 3 caption',
                    order: 3,
                    latestRevisionDate: latestRevisionDate.toISOString() as db.TimestampString,
                },
            ])
            .run(conn);

        // Verify all images have deletedAt as null
        const beforeRows = await db.select('RopewikiImage', { ropewikiPage: testPageUuid }).run(conn);
        expect(beforeRows).toHaveLength(3);
        beforeRows.forEach(image => {
            expect(image.deletedAt).toBeNull();
        });

        // Set deletedAt for all (empty updatedImageIds)
        await setImagesDeletedAt(conn, testPageUuid, []);

        // Verify all images now have deletedAt set
        const afterRows = await db.select('RopewikiImage', { ropewikiPage: testPageUuid }).run(conn);
        expect(afterRows).toHaveLength(3);
        afterRows.forEach(image => {
            expect(image.deletedAt).not.toBeNull();
            expect(new Date(image.deletedAt as string).getTime()).toBeCloseTo(Date.now(), -3); // Within 1 second
        });
    });

    it('sets deletedAt only for images NOT in updatedImageIds', async () => {
        const latestRevisionDate = new Date('2025-01-01T00:00:00Z');

        // Insert images directly with known IDs
        const image1Id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
        const image2Id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
        const image3Id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

        await db
            .insert('RopewikiImage', [
                {
                    id: image1Id,
                    ropewikiPage: testPageUuid,
                    fileUrl: 'https://ropewiki.com/files/Image1.jpg',
                    linkUrl: 'https://ropewiki.com/Image1',
                    caption: 'Image 1 caption',
                    order: 1,
                    latestRevisionDate: latestRevisionDate.toISOString() as db.TimestampString,
                },
                {
                    id: image2Id,
                    ropewikiPage: testPageUuid,
                    fileUrl: 'https://ropewiki.com/files/Image2.jpg',
                    linkUrl: 'https://ropewiki.com/Image2',
                    caption: 'Image 2 caption',
                    order: 2,
                    latestRevisionDate: latestRevisionDate.toISOString() as db.TimestampString,
                },
                {
                    id: image3Id,
                    ropewikiPage: testPageUuid,
                    fileUrl: 'https://ropewiki.com/files/Image3.jpg',
                    linkUrl: 'https://ropewiki.com/Image3',
                    caption: 'Image 3 caption',
                    order: 3,
                    latestRevisionDate: latestRevisionDate.toISOString() as db.TimestampString,
                },
            ])
            .run(conn);

        // Verify all images have deletedAt as null
        const beforeRows = await db.select('RopewikiImage', { ropewikiPage: testPageUuid }).run(conn);
        expect(beforeRows).toHaveLength(3);
        beforeRows.forEach(image => {
            expect(image.deletedAt).toBeNull();
        });

        // Set deletedAt for images NOT in [image1Id, image2Id]
        // This should mark image3Id as deleted
        await setImagesDeletedAt(conn, testPageUuid, [image1Id, image2Id]);

        // Verify image1 and image2 still have deletedAt as null
        const image1 = await db.select('RopewikiImage', { id: image1Id }).run(conn);
        const image2 = await db.select('RopewikiImage', { id: image2Id }).run(conn);
        const image3 = await db.select('RopewikiImage', { id: image3Id }).run(conn);

        expect(image1[0]?.deletedAt).toBeNull();
        expect(image2[0]?.deletedAt).toBeNull();
        expect(image3[0]?.deletedAt).not.toBeNull();
        expect(new Date(image3[0]?.deletedAt as string).getTime()).toBeCloseTo(Date.now(), -3);
    });

    it('does not set deletedAt when all images are in updatedImageIds', async () => {
        const latestRevisionDate = new Date('2025-01-01T00:00:00Z');

        // Insert images directly with known IDs
        const image1Id = '11111111-1111-1111-1111-111111111112';
        const image2Id = '22222222-2222-2222-2222-222222222223';

        await db
            .insert('RopewikiImage', [
                {
                    id: image1Id,
                    ropewikiPage: testPageUuid,
                    fileUrl: 'https://ropewiki.com/files/Image1.jpg',
                    linkUrl: 'https://ropewiki.com/Image1',
                    caption: 'Image 1 caption',
                    order: 1,
                    latestRevisionDate: latestRevisionDate.toISOString() as db.TimestampString,
                },
                {
                    id: image2Id,
                    ropewikiPage: testPageUuid,
                    fileUrl: 'https://ropewiki.com/files/Image2.jpg',
                    linkUrl: 'https://ropewiki.com/Image2',
                    caption: 'Image 2 caption',
                    order: 2,
                    latestRevisionDate: latestRevisionDate.toISOString() as db.TimestampString,
                },
            ])
            .run(conn);

        // Verify all images have deletedAt as null
        const beforeRows = await db.select('RopewikiImage', { ropewikiPage: testPageUuid }).run(conn);
        expect(beforeRows).toHaveLength(2);
        beforeRows.forEach(image => {
            expect(image.deletedAt).toBeNull();
        });

        // Set deletedAt for images NOT in [image1Id, image2Id]
        // Since all images are in the list, none should be marked as deleted
        await setImagesDeletedAt(conn, testPageUuid, [image1Id, image2Id]);

        // Verify all images still have deletedAt as null
        const afterRows = await db.select('RopewikiImage', { ropewikiPage: testPageUuid }).run(conn);
        expect(afterRows).toHaveLength(2);
        afterRows.forEach(image => {
            expect(image.deletedAt).toBeNull();
        });
    });

    it('only affects images for the specified pageUuid', async () => {
        const latestRevisionDate = new Date('2025-01-01T00:00:00Z');

        // Create a second page
        const testPageUuid2 = '33333333-3333-3333-3333-333333333333';
        await db
            .insert('RopewikiPage', {
                id: testPageUuid2,
                pageId: '8888',
                name: 'Test Page 2',
                region: testRegionId,
                url: 'https://ropewiki.com/Test_Page_2',
                months: [],
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);

        // Insert images for both pages with known IDs
        const page1ImageId = '44444444-4444-4444-4444-444444444444';
        const page2ImageId = '55555555-5555-5555-5555-555555555555';

        await db
            .insert('RopewikiImage', [
                {
                    id: page1ImageId,
                    ropewikiPage: testPageUuid,
                    fileUrl: 'https://ropewiki.com/files/Page1Image.jpg',
                    linkUrl: 'https://ropewiki.com/Page1Image',
                    caption: 'Page1 Image caption',
                    order: 1,
                    latestRevisionDate: latestRevisionDate.toISOString() as db.TimestampString,
                },
                {
                    id: page2ImageId,
                    ropewikiPage: testPageUuid2,
                    fileUrl: 'https://ropewiki.com/files/Page2Image.jpg',
                    linkUrl: 'https://ropewiki.com/Page2Image',
                    caption: 'Page2 Image caption',
                    order: 1,
                    latestRevisionDate: latestRevisionDate.toISOString() as db.TimestampString,
                },
            ])
            .run(conn);

        // Set deletedAt for page1 (empty updatedImageIds)
        await setImagesDeletedAt(conn, testPageUuid, []);

        // Verify page1 image is deleted
        const page1Image = await db.select('RopewikiImage', { id: page1ImageId }).run(conn);
        expect(page1Image[0]?.deletedAt).not.toBeNull();

        // Verify page2 image is NOT deleted
        const page2Image = await db.select('RopewikiImage', { id: page2ImageId }).run(conn);
        expect(page2Image[0]?.deletedAt).toBeNull();
    });

    it('does not update deletedAt for images that already have deletedAt set', async () => {
        const latestRevisionDate = new Date('2025-01-01T00:00:00Z');

        // Insert images directly with known IDs
        const image1Id = '66666666-6666-6666-6666-666666666666';
        const image2Id = '77777777-7777-7777-7777-777777777777';
        const image3Id = '88888888-8888-8888-8888-888888888888';
        const oldDeletedAt = new Date('2025-01-01T10:00:00Z');

        await db
            .insert('RopewikiImage', [
                {
                    id: image1Id,
                    ropewikiPage: testPageUuid,
                    fileUrl: 'https://ropewiki.com/files/Image1.jpg',
                    linkUrl: 'https://ropewiki.com/Image1',
                    caption: 'Image 1 caption',
                    order: 1,
                    latestRevisionDate: latestRevisionDate.toISOString() as db.TimestampString,
                },
                {
                    id: image2Id,
                    ropewikiPage: testPageUuid,
                    fileUrl: 'https://ropewiki.com/files/Image2.jpg',
                    linkUrl: 'https://ropewiki.com/Image2',
                    caption: 'Image 2 caption',
                    order: 2,
                    latestRevisionDate: latestRevisionDate.toISOString() as db.TimestampString,
                    deletedAt: oldDeletedAt.toISOString() as db.TimestampString,
                },
                {
                    id: image3Id,
                    ropewikiPage: testPageUuid,
                    fileUrl: 'https://ropewiki.com/files/Image3.jpg',
                    linkUrl: 'https://ropewiki.com/Image3',
                    caption: 'Image 3 caption',
                    order: 3,
                    latestRevisionDate: latestRevisionDate.toISOString() as db.TimestampString,
                },
            ])
            .run(conn);

        // Verify image2 is already deleted
        const beforeImage2 = await db.select('RopewikiImage', { id: image2Id }).run(conn);
        expect(beforeImage2[0]?.deletedAt).not.toBeNull();
        const beforeDeletedAtValue = beforeImage2[0]?.deletedAt as string;

        // Wait a bit to ensure new timestamp would be different
        await new Promise(resolve => setTimeout(resolve, 100));

        // Set deletedAt for images NOT in [image1Id]
        // This should update image3 (deletedAt is null) but NOT image2 (deletedAt already set)
        await setImagesDeletedAt(conn, testPageUuid, [image1Id]);

        // Verify image1 still has deletedAt as null (it's in updatedImageIds)
        const image1 = await db.select('RopewikiImage', { id: image1Id }).run(conn);
        expect(image1[0]?.deletedAt).toBeNull();

        // Verify image2's deletedAt was NOT updated (it already had a value)
        const afterImage2 = await db.select('RopewikiImage', { id: image2Id }).run(conn);
        expect(afterImage2[0]?.deletedAt).not.toBeNull();
        const afterDeletedAtValue = afterImage2[0]?.deletedAt as string;
        // The value should be exactly the same (not updated)
        expect(afterDeletedAtValue).toBe(beforeDeletedAtValue);

        // Verify image3's deletedAt was updated (it was null and not in updatedImageIds)
        const image3 = await db.select('RopewikiImage', { id: image3Id }).run(conn);
        expect(image3[0]?.deletedAt).not.toBeNull();
        expect(new Date(image3[0]?.deletedAt as string).getTime()).toBeCloseTo(Date.now(), -3);
    });

    it('propagates errors from the database layer', async () => {
        // Use a client with a non-existent database to force an error
        const badPool = new Pool({
            user: process.env.TEST_USER,
            password: process.env.TEST_PASS,
            host: process.env.TEST_HOST,
            port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
            database: 'nonexistent_database_for_test_error_set_images_deleted_at',
        });

        await expect(setImagesDeletedAt(badPool, testPageUuid, [])).rejects.toBeDefined();

        await badPool.end();
    });
});

