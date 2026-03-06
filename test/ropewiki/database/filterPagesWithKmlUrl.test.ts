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
                parentRegionName: null,
                name: 'Test Region',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
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

    it('returns ids that have KML URLs', async () => {
        const id1 = '11111111-1111-1111-1111-111111111111';
        const id2 = '22222222-2222-2222-2222-222222222222';
        const kmlUrl1 = 'https://example.com/page1.kml';
        const kmlUrl2 = 'https://example.com/page2.kml';

        await db
            .insert('RopewikiPage', [
                {
                    id: id1,
                    pageId: 'page-with-kml-1',
                    name: 'Page 1',
                    region: testRegionId,
                    url: 'https://example.com/page1',
                    kmlUrl: kmlUrl1,
                },
                {
                    id: id2,
                    pageId: 'page-with-kml-2',
                    name: 'Page 2',
                    region: testRegionId,
                    url: 'https://example.com/page2',
                    kmlUrl: kmlUrl2,
                },
            ])
            .run(conn);

        const result = await filterPagesWithKmlUrl(conn, [id1, id2]);

        expect(result).toHaveLength(2);
        expect(result).toContain(id1);
        expect(result).toContain(id2);
    });

    it('returns empty array when no pages have KML URLs', async () => {
        const id1 = '33333333-3333-3333-3333-333333333333';
        const id2 = '44444444-4444-4444-4444-444444444444';

        await db
            .insert('RopewikiPage', [
                {
                    id: id1,
                    pageId: 'page-without-kml-1',
                    name: 'Page 1',
                    region: testRegionId,
                    url: 'https://example.com/page1',
                    kmlUrl: null,
                },
                {
                    id: id2,
                    pageId: 'page-without-kml-2',
                    name: 'Page 2',
                    region: testRegionId,
                    url: 'https://example.com/page2',
                    kmlUrl: null,
                },
            ])
            .run(conn);

        const result = await filterPagesWithKmlUrl(conn, [id1, id2]);

        expect(result).toHaveLength(0);
        expect(result).toEqual([]);
    });

    it('returns empty array when input is empty', async () => {
        const result = await filterPagesWithKmlUrl(conn, []);

        expect(result).toHaveLength(0);
        expect(result).toEqual([]);
    });

    it('filters correctly when some pages have KML URLs and some do not', async () => {
        const idWithKml1 = '55555555-5555-5555-5555-555555555555';
        const idWithKml2 = '66666666-6666-6666-6666-666666666666';
        const idWithoutKml1 = '77777777-7777-7777-7777-777777777777';
        const idWithoutKml2 = '88888888-8888-8888-8888-888888888888';
        const kmlUrl1 = 'https://example.com/page1.kml';
        const kmlUrl2 = 'https://example.com/page2.kml';

        await db
            .insert('RopewikiPage', [
                {
                    id: idWithKml1,
                    pageId: 'page-with-kml-1',
                    name: 'Page With KML 1',
                    region: testRegionId,
                    url: 'https://example.com/page1',
                    kmlUrl: kmlUrl1,
                },
                {
                    id: idWithKml2,
                    pageId: 'page-with-kml-2',
                    name: 'Page With KML 2',
                    region: testRegionId,
                    url: 'https://example.com/page2',
                    kmlUrl: kmlUrl2,
                },
                {
                    id: idWithoutKml1,
                    pageId: 'page-without-kml-1',
                    name: 'Page Without KML 1',
                    region: testRegionId,
                    url: 'https://example.com/page3',
                    kmlUrl: null,
                },
                {
                    id: idWithoutKml2,
                    pageId: 'page-without-kml-2',
                    name: 'Page Without KML 2',
                    region: testRegionId,
                    url: 'https://example.com/page4',
                    kmlUrl: null,
                },
            ])
            .run(conn);

        const result = await filterPagesWithKmlUrl(conn, [
            idWithKml1,
            idWithKml2,
            idWithoutKml1,
            idWithoutKml2,
        ]);

        expect(result).toHaveLength(2);
        expect(result).toContain(idWithKml1);
        expect(result).toContain(idWithKml2);
        expect(result).not.toContain(idWithoutKml1);
        expect(result).not.toContain(idWithoutKml2);
    });

    it('excludes ids not in the database', async () => {
        const idWithKml = '99999999-9999-9999-9999-999999999999';
        const nonExistentId1 = '00000000-0000-0000-0000-000000000001';
        const nonExistentId2 = '00000000-0000-0000-0000-000000000002';
        const kmlUrl = 'https://example.com/page.kml';

        await db
            .insert('RopewikiPage', {
                id: idWithKml,
                pageId: 'page-with-kml',
                name: 'Page With KML',
                region: testRegionId,
                url: 'https://example.com/page',
                kmlUrl: kmlUrl,
            })
            .run(conn);

        const result = await filterPagesWithKmlUrl(conn, [
            idWithKml,
            nonExistentId1,
            nonExistentId2,
        ]);

        expect(result).toHaveLength(1);
        expect(result).toContain(idWithKml);
        expect(result).not.toContain(nonExistentId1);
        expect(result).not.toContain(nonExistentId2);
    });

    it('handles pages with null KML URL correctly', async () => {
        const idWithNullKml = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        const idWithKml = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
        const kmlUrl = 'https://example.com/page.kml';

        await db
            .insert('RopewikiPage', [
                {
                    id: idWithNullKml,
                    pageId: 'page-null-kml',
                    name: 'Page With Null KML',
                    region: testRegionId,
                    url: 'https://example.com/page1',
                    kmlUrl: null,
                },
                {
                    id: idWithKml,
                    pageId: 'page-with-kml',
                    name: 'Page With KML',
                    region: testRegionId,
                    url: 'https://example.com/page2',
                    kmlUrl: kmlUrl,
                },
            ])
            .run(conn);

        const result = await filterPagesWithKmlUrl(conn, [idWithNullKml, idWithKml]);

        expect(result).toHaveLength(1);
        expect(result).toContain(idWithKml);
        expect(result).not.toContain(idWithNullKml);
    });

    it('propagates database errors', async () => {
        const badPool = new Pool({
            user: process.env.TEST_USER,
            password: process.env.TEST_PASS,
            host: process.env.TEST_HOST,
            port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
            database: 'nonexistent_database_for_test_error_filter_kml',
        });

        await expect(
            filterPagesWithKmlUrl(badPool, ['11111111-1111-1111-1111-111111111111']),
        ).rejects.toBeDefined();

        await badPool.end();
    });
});
