import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as db from 'zapatos/db';
import getPageRowsByIds from '../../../../src/api/search/database/getPageRowsByIds';

describe('getPageRowsByIds (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT
            ? parseInt(process.env.TEST_PORT, 10)
            : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;

    const regionId = 'd4000001-0001-4000-8000-000000000001';
    const page1Id = 'e4000001-0001-4000-8000-000000000001';
    const page2Id = 'e4000002-0002-4000-8000-000000000002';
    const page3Id = 'e4000003-0003-4000-8000-000000000003';

    beforeAll(async () => {
        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegion: null,
                name: 'PageRowsTestRegion',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/PageRowsTestRegion',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: page1Id,
                pageId: 'pagerows-1',
                name: 'PageRowsTestMatching',
                region: regionId,
                url: 'https://ropewiki.com/PageRowsTestMatching',
                latestRevisionDate:
                    '2025-01-01T00:00:00' as db.TimestampString,
                quality: 1,
                userVotes: 1,
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: page2Id,
                pageId: 'pagerows-2',
                name: 'PageRowsTestAlsoMatching',
                region: regionId,
                url: 'https://ropewiki.com/PageRowsTestAlsoMatching',
                latestRevisionDate:
                    '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: page3Id,
                pageId: 'pagerows-3',
                name: 'XyZzNoMatchQqWw',
                region: regionId,
                url: 'https://ropewiki.com/XyZzNoMatchQqWw',
                latestRevisionDate:
                    '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);
    });

    afterAll(async () => {
        await db
            .sql`DELETE FROM "RopewikiPage" WHERE id IN (${db.param(page1Id)}, ${db.param(page2Id)}, ${db.param(page3Id)})`.run(conn);
        await db
            .sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}`.run(conn);
        await pool.end();
    });

    it('returns empty Map when pageIds is empty', async () => {
        const result = await getPageRowsByIds(
            conn,
            'PageRowsTest',
            0.1,
            [],
        );
        expect(result.size).toBe(0);
    });

    it('returns rows for pages matching name above similarity threshold', async () => {
        const result = await getPageRowsByIds(
            conn,
            'PageRowsTest',
            0.1,
            [page1Id, page2Id, page3Id],
        );
        expect(result.size).toBe(2);
        expect(result.has(page1Id)).toBe(true);
        expect(result.has(page2Id)).toBe(true);
        expect(result.has(page3Id)).toBe(false);
        const row1 = result.get(page1Id)!;
        expect(row1.title).toBe('PageRowsTestMatching');
        expect(row1.regionId).toBe(regionId);
        expect(row1.regionName).toBe('PageRowsTestRegion');
    });

    it('excludes pages below similarity threshold', async () => {
        const result = await getPageRowsByIds(
            conn,
            'PageRowsTestMatching',
            0.99,
            [page1Id, page2Id],
        );
        expect(result.size).toBe(1);
        expect(result.has(page1Id)).toBe(true);
        expect(result.has(page2Id)).toBe(false);
    });

    it('returns map keyed by page id', async () => {
        const result = await getPageRowsByIds(
            conn,
            'PageRowsTest',
            0.1,
            [page1Id],
        );
        expect(result.size).toBe(1);
        const row = result.get(page1Id)!;
        expect(row).toBeDefined();
        expect(row.title).toBe('PageRowsTestMatching');
    });

    it('includes mapData null when page has no RopewikiRoute', async () => {
        const result = await getPageRowsByIds(
            conn,
            'PageRowsTest',
            0.1,
            [page1Id],
        );
        const row = result.get(page1Id)!;
        expect(row.mapData).toBeNull();
    });

    it('includes mapData from RopewikiRoute when route exists', async () => {
        const routeId = 'c4000001-0001-4000-8000-000000000001';
        await db
            .insert('Route', {
                id: routeId,
                name: 'PageRowsTestRoute',
                type: 'Canyon',
                coordinates: { lat: 40, lon: -111 },
            })
            .run(conn);
        await db
            .insert('RopewikiRoute', {
                route: routeId,
                ropewikiPage: page1Id,
                mapData: null,
            })
            .run(conn);

        const result = await getPageRowsByIds(
            conn,
            'PageRowsTest',
            0.1,
            [page1Id],
        );
        const row = result.get(page1Id)!;
        expect(row).toBeDefined();
        expect(row.mapData).toBeNull();

        await db
            .sql`DELETE FROM "RopewikiRoute" WHERE "ropewikiPage" = ${db.param(page1Id)}`.run(conn);
        await db
            .sql`DELETE FROM "Route" WHERE id = ${db.param(routeId)}`.run(conn);
    });
});
