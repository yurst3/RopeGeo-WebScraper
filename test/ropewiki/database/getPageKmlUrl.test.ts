import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import getPageKmlUrl from '../../../src/ropewiki/database/getPageKmlUrl';

describe('getPageKmlUrl (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;

    beforeAll(async () => {
        // Ensure tables exist and are empty
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
    });

    afterEach(async () => {
        // Clean between tests
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
    });

    afterAll(async () => {
        await pool.end();
    });

    it('returns the KML URL when the page has one', async () => {
        const regionId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
        const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';
        const kmlUrl = 'https://example.com/page.kml';
        const latestRevisionDate = '2025-01-01T00:00:00' as db.TimestampString;

        // Insert a region first (required foreign key)
        await db
            .insert('RopewikiRegion', [
                {
                    id: regionId,
                    parentRegionName: null,
                    name: 'Test Region',
                    latestRevisionDate,
                    rawPageCount: 1,
                    level: 0,
                    overview: null,
                    bestMonths: JSON.stringify([]),
                    isMajorRegion: false,
                    isTopLevelRegion: true,
                    url: 'https://ropewiki.com/Test_Region',
                },
            ])
            .run(conn);

        // Insert a page with a KML URL
        await db
            .insert('RopewikiPage', [
                {
                    id: pageId,
                    pageId: '12345',
                    name: 'Test Page',
                    region: regionId,
                    url: 'https://ropewiki.com/Test_Page',
                    kmlUrl,
                    latestRevisionDate,
                },
            ])
            .run(conn);

        const result = await getPageKmlUrl(conn, pageId);

        expect(result).toBe(kmlUrl);
    });

    it('returns undefined when the page has no KML URL', async () => {
        const regionId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
        const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';
        const latestRevisionDate = '2025-01-01T00:00:00' as db.TimestampString;

        // Insert a region first (required foreign key)
        await db
            .insert('RopewikiRegion', [
                {
                    id: regionId,
                    parentRegionName: null,
                    name: 'Test Region',
                    latestRevisionDate,
                    rawPageCount: 1,
                    level: 0,
                    overview: null,
                    bestMonths: JSON.stringify([]),
                    isMajorRegion: false,
                    isTopLevelRegion: true,
                    url: 'https://ropewiki.com/Test_Region',
                },
            ])
            .run(conn);

        // Insert a page without a KML URL
        await db
            .insert('RopewikiPage', [
                {
                    id: pageId,
                    pageId: '12345',
                    name: 'Test Page',
                    region: regionId,
                    url: 'https://ropewiki.com/Test_Page',
                    kmlUrl: null,
                    latestRevisionDate,
                },
            ])
            .run(conn);

        const result = await getPageKmlUrl(conn, pageId);

        expect(result).toBeUndefined();
    });

    it('returns undefined when the page is not found', async () => {
        const nonExistentPageId = '00000000-0000-0000-0000-000000000000';

        const result = await getPageKmlUrl(conn, nonExistentPageId);

        expect(result).toBeUndefined();
    });

    it('returns the correct KML URL when multiple pages exist', async () => {
        const regionId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
        const pageId1 = 'd1d9139d-38db-433c-b7cd-a28f79331667';
        const pageId2 = 'e2e9240e-49ec-544d-c8de-b39f90442778';
        const kmlUrl1 = 'https://example.com/page1.kml';
        const kmlUrl2 = 'https://example.com/page2.kml';
        const latestRevisionDate = '2025-01-01T00:00:00' as db.TimestampString;

        // Insert a region first (required foreign key)
        await db
            .insert('RopewikiRegion', [
                {
                    id: regionId,
                    parentRegionName: null,
                    name: 'Test Region',
                    latestRevisionDate,
                    rawPageCount: 2,
                    level: 0,
                    overview: null,
                    bestMonths: JSON.stringify([]),
                    isMajorRegion: false,
                    isTopLevelRegion: true,
                    url: 'https://ropewiki.com/Test_Region',
                },
            ])
            .run(conn);

        // Insert multiple pages
        await db
            .insert('RopewikiPage', [
                {
                    id: pageId1,
                    pageId: '12345',
                    name: 'Test Page 1',
                    region: regionId,
                    url: 'https://ropewiki.com/Test_Page_1',
                    kmlUrl: kmlUrl1,
                    latestRevisionDate,
                },
                {
                    id: pageId2,
                    pageId: '67890',
                    name: 'Test Page 2',
                    region: regionId,
                    url: 'https://ropewiki.com/Test_Page_2',
                    kmlUrl: kmlUrl2,
                    latestRevisionDate,
                },
            ])
            .run(conn);

        const result1 = await getPageKmlUrl(conn, pageId1);
        const result2 = await getPageKmlUrl(conn, pageId2);

        expect(result1).toBe(kmlUrl1);
        expect(result2).toBe(kmlUrl2);
    });

    it('propagates errors from the database layer', async () => {
        const badPool = new Pool({
            user: process.env.TEST_USER,
            password: process.env.TEST_PASS,
            host: process.env.TEST_HOST,
            port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
            database: 'nonexistent_database_for_test_error_get_page_kml_url',
        });

        await expect(getPageKmlUrl(badPool, '00000000-0000-0000-0000-000000000000')).rejects.toBeDefined();

        await badPool.end();
    });
});
