import { Pool } from 'pg';
import {
    describe,
    it,
    expect,
    beforeAll,
    afterAll,
    afterEach,
} from '@jest/globals';
import * as db from 'zapatos/db';
import getBannerImageMetadataForPage from '../../../../src/api/getRopewikiPageLinkPreview/database/getBannerImageMetadataForPage';

describe('getBannerImageMetadataForPage (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;
    const testRegionId = 'bbbbbbbb-bbbb-4e48-99a6-81608cc0051d';

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiImage"`.run(conn);
        await db.sql`DELETE FROM "ImageData"`.run(conn);
        await db.sql`DELETE FROM "RopewikiBetaSection"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRoute"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "MapData"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);

        await db
            .insert('RopewikiRegion', {
                id: testRegionId,
                parentRegionName: null,
                name: 'LinkPreviewRegion',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: JSON.stringify([]),
                url: 'https://ropewiki.com/LinkPreviewRegion',
            })
            .run(conn);
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "RopewikiImage"`.run(conn);
        await db.sql`DELETE FROM "ImageData"`.run(conn);
        await db.sql`DELETE FROM "RopewikiBetaSection"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRoute"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "MapData"`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiImage"`.run(conn);
        await db.sql`DELETE FROM "ImageData"`.run(conn);
        await db.sql`DELETE FROM "RopewikiBetaSection"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRoute"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "MapData"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
        await pool.end();
    });

    it('returns null when page has no banner row', async () => {
        const pageId = 'c0c0c0c0-e5f6-7890-abcd-ef1234567801';
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: 'lp-1',
                name: 'No Banner',
                region: testRegionId,
                url: 'https://ropewiki.com/No_Banner',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);

        const meta = await getBannerImageMetadataForPage(conn, pageId);
        expect(meta).toBeNull();
    });

    it('returns null when banner row has no processed ImageData', async () => {
        const pageId = 'c0c0c0c0-e5f6-7890-abcd-ef1234567802';
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: 'lp-2',
                name: 'Banner No Data',
                region: testRegionId,
                url: 'https://ropewiki.com/Banner_No_Data',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                ropewikiPage: pageId,
                betaSection: null,
                linkUrl: 'https://ropewiki.com/File:b.jpg',
                fileUrl: 'https://ropewiki.com/thumb/b.jpg',
                order: 0,
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                processedImage: null,
            })
            .run(conn);

        const meta = await getBannerImageMetadataForPage(conn, pageId);
        expect(meta).toBeNull();
    });

    it('returns metadata for first banner row by order (betaSection null)', async () => {
        const pageId = 'c0c0c0c0-e5f6-7890-abcd-ef1234567803';
        const sectionId = 'c0c0c0c0-e5f6-7890-abcd-ef1234567804';
        const dataEarly = 'c0c0c0c0-e5f6-7890-abcd-ef1234567805';
        const dataLate = 'c0c0c0c0-e5f6-7890-abcd-ef1234567806';
        const metaEarly = { banner: { dimensions: { width: 100, height: 50 }, sizeKB: 1, orientation: 1 } };
        const metaLate = { banner: { dimensions: { width: 999, height: 999 }, sizeKB: 2, orientation: 1 } };

        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: 'lp-3',
                name: 'Order Test',
                region: testRegionId,
                url: 'https://ropewiki.com/Order_Test',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);
        await db
            .insert('RopewikiBetaSection', {
                id: sectionId,
                ropewikiPage: pageId,
                order: 1,
                title: 'S',
                text: 'T',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);

        await db
            .insert('ImageData', {
                id: dataEarly,
                bannerUrl: 'https://api.example.com/a.avif',
                fullUrl: 'https://api.example.com/fa.avif',
                sourceUrl: 'https://ropewiki.com/File:a.jpg',
                metadata: metaEarly as unknown as db.JSONValue,
            })
            .run(conn);
        await db
            .insert('ImageData', {
                id: dataLate,
                bannerUrl: 'https://api.example.com/b.avif',
                fullUrl: 'https://api.example.com/fb.avif',
                sourceUrl: 'https://ropewiki.com/File:b.jpg',
                metadata: metaLate as unknown as db.JSONValue,
            })
            .run(conn);

        await db
            .insert('RopewikiImage', {
                ropewikiPage: pageId,
                betaSection: null,
                linkUrl: 'https://ropewiki.com/File:late.jpg',
                fileUrl: 'https://ropewiki.com/thumb/late.jpg',
                order: 1,
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                processedImage: dataLate,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                ropewikiPage: pageId,
                betaSection: null,
                linkUrl: 'https://ropewiki.com/File:early.jpg',
                fileUrl: 'https://ropewiki.com/thumb/early.jpg',
                order: 0,
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                processedImage: dataEarly,
            })
            .run(conn);

        const meta = await getBannerImageMetadataForPage(conn, pageId);
        expect(meta).toEqual(metaEarly);
    });
});
