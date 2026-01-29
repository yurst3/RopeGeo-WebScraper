import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import filterPagesWithKmlUrl from '../../../src/ropewiki/database/filterPagesWithKmlUrl';

describe('filterPagesWithKmlUrl (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;
    const testRegionId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';

    beforeAll(async () => {
        // Clean tables
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
    });

    afterEach(async () => {
        // Clean between tests
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
        await pool.end();
    });

    it('returns pageIds that have KML URLs', async () => {
        const pageId1 = 'page-with-kml-1';
        const pageId2 = 'page-with-kml-2';
        const kmlUrl1 = 'https://example.com/page1.kml';
        const kmlUrl2 = 'https://example.com/page2.kml';

        await db
            .insert('RopewikiPage', [
                {
                    id: '11111111-1111-1111-1111-111111111111',
                    pageId: pageId1,
                    name: 'Page 1',
                    region: testRegionId,
                    url: 'https://example.com/page1',
                    kmlUrl: kmlUrl1,
                },
                {
                    id: '22222222-2222-2222-2222-222222222222',
                    pageId: pageId2,
                    name: 'Page 2',
                    region: testRegionId,
                    url: 'https://example.com/page2',
                    kmlUrl: kmlUrl2,
                },
            ])
            .run(conn);

        const result = await filterPagesWithKmlUrl(conn, [pageId1, pageId2]);

        expect(result).toHaveLength(2);
        expect(result).toContain(pageId1);
        expect(result).toContain(pageId2);
    });

    it('returns empty array when no pages have KML URLs', async () => {
        const pageId1 = 'page-without-kml-1';
        const pageId2 = 'page-without-kml-2';

        await db
            .insert('RopewikiPage', [
                {
                    id: '33333333-3333-3333-3333-333333333333',
                    pageId: pageId1,
                    name: 'Page 1',
                    region: testRegionId,
                    url: 'https://example.com/page1',
                    kmlUrl: null,
                },
                {
                    id: '44444444-4444-4444-4444-444444444444',
                    pageId: pageId2,
                    name: 'Page 2',
                    region: testRegionId,
                    url: 'https://example.com/page2',
                    kmlUrl: null,
                },
            ])
            .run(conn);

        const result = await filterPagesWithKmlUrl(conn, [pageId1, pageId2]);

        expect(result).toHaveLength(0);
        expect(result).toEqual([]);
    });

    it('returns empty array when input is empty', async () => {
        const result = await filterPagesWithKmlUrl(conn, []);

        expect(result).toHaveLength(0);
        expect(result).toEqual([]);
    });

    it('filters correctly when some pages have KML URLs and some do not', async () => {
        const pageIdWithKml1 = 'page-with-kml';
        const pageIdWithKml2 = 'page-with-kml-2';
        const pageIdWithoutKml1 = 'page-without-kml';
        const pageIdWithoutKml2 = 'page-without-kml-2';
        const kmlUrl1 = 'https://example.com/page1.kml';
        const kmlUrl2 = 'https://example.com/page2.kml';

        await db
            .insert('RopewikiPage', [
                {
                    id: '55555555-5555-5555-5555-555555555555',
                    pageId: pageIdWithKml1,
                    name: 'Page With KML 1',
                    region: testRegionId,
                    url: 'https://example.com/page1',
                    kmlUrl: kmlUrl1,
                },
                {
                    id: '66666666-6666-6666-6666-666666666666',
                    pageId: pageIdWithKml2,
                    name: 'Page With KML 2',
                    region: testRegionId,
                    url: 'https://example.com/page2',
                    kmlUrl: kmlUrl2,
                },
                {
                    id: '77777777-7777-7777-7777-777777777777',
                    pageId: pageIdWithoutKml1,
                    name: 'Page Without KML 1',
                    region: testRegionId,
                    url: 'https://example.com/page3',
                    kmlUrl: null,
                },
                {
                    id: '88888888-8888-8888-8888-888888888888',
                    pageId: pageIdWithoutKml2,
                    name: 'Page Without KML 2',
                    region: testRegionId,
                    url: 'https://example.com/page4',
                    kmlUrl: null,
                },
            ])
            .run(conn);

        const result = await filterPagesWithKmlUrl(conn, [
            pageIdWithKml1,
            pageIdWithKml2,
            pageIdWithoutKml1,
            pageIdWithoutKml2,
        ]);

        expect(result).toHaveLength(2);
        expect(result).toContain(pageIdWithKml1);
        expect(result).toContain(pageIdWithKml2);
        expect(result).not.toContain(pageIdWithoutKml1);
        expect(result).not.toContain(pageIdWithoutKml2);
    });

    it('excludes pageIds not in the database', async () => {
        const pageIdWithKml = 'page-with-kml';
        const nonExistentPageId1 = 'non-existent-1';
        const nonExistentPageId2 = 'non-existent-2';
        const kmlUrl = 'https://example.com/page.kml';

        await db
            .insert('RopewikiPage', {
                id: '99999999-9999-9999-9999-999999999999',
                pageId: pageIdWithKml,
                name: 'Page With KML',
                region: testRegionId,
                url: 'https://example.com/page',
                kmlUrl: kmlUrl,
            })
            .run(conn);

        const result = await filterPagesWithKmlUrl(conn, [
            pageIdWithKml,
            nonExistentPageId1,
            nonExistentPageId2,
        ]);

        expect(result).toHaveLength(1);
        expect(result).toContain(pageIdWithKml);
        expect(result).not.toContain(nonExistentPageId1);
        expect(result).not.toContain(nonExistentPageId2);
    });

    it('handles pages with null KML URL correctly', async () => {
        const pageIdWithNullKml = 'page-null-kml';
        const pageIdWithKml = 'page-with-kml';
        const kmlUrl = 'https://example.com/page.kml';

        await db
            .insert('RopewikiPage', [
                {
                    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                    pageId: pageIdWithNullKml,
                    name: 'Page With Null KML',
                    region: testRegionId,
                    url: 'https://example.com/page1',
                    kmlUrl: null,
                },
                {
                    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
                    pageId: pageIdWithKml,
                    name: 'Page With KML',
                    region: testRegionId,
                    url: 'https://example.com/page2',
                    kmlUrl: kmlUrl,
                },
            ])
            .run(conn);

        const result = await filterPagesWithKmlUrl(conn, [pageIdWithNullKml, pageIdWithKml]);

        expect(result).toHaveLength(1);
        expect(result).toContain(pageIdWithKml);
        expect(result).not.toContain(pageIdWithNullKml);
    });

    it('propagates database errors', async () => {
        const badPool = new Pool({
            user: process.env.TEST_USER,
            password: process.env.TEST_PASS,
            host: process.env.TEST_HOST,
            port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
            database: 'nonexistent_database_for_test_error_filter_kml',
        });

        await expect(filterPagesWithKmlUrl(badPool, ['page-1'])).rejects.toBeDefined();

        await badPool.end();
    });
});
