import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as db from 'zapatos/db';
import getRegionRowsByIds from '../../../../src/api/search/database/getRegionRowsByIds';

describe('getRegionRowsByIds (integration)', () => {
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

    const region1Id = 'd5000001-0001-4000-8000-000000000001';
    const region2Id = 'd5000002-0002-4000-8000-000000000002';

    beforeAll(async () => {
        await db
            .insert('RopewikiRegion', {
                id: region1Id,
                parentRegion: null,
                name: 'RegionRowsTestOne',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                pageCount: 10,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/RegionRowsTestOne',
            })
            .run(conn);
        await db
            .insert('RopewikiRegion', {
                id: region2Id,
                parentRegion: region1Id,
                name: 'RegionRowsTestTwo',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                pageCount: 3,
                level: 1,
                bestMonths: [],
                url: 'https://ropewiki.com/RegionRowsTestTwo',
            })
            .run(conn);
    });

    afterAll(async () => {
        await db
            .sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(region2Id)}`.run(conn);
        await db
            .sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(region1Id)}`.run(conn);
        await pool.end();
    });

    it('returns empty Map when regionIds is empty', async () => {
        const result = await getRegionRowsByIds(conn, []);
        expect(result.size).toBe(0);
    });

    it('returns rows for requested region ids', async () => {
        const result = await getRegionRowsByIds(conn, [region1Id, region2Id]);

        expect(result.size).toBe(2);
        const r1 = result.get(region1Id)!;
        expect(r1.id).toBe(region1Id);
        expect(r1.name).toBe('RegionRowsTestOne');
        expect(r1.url).toBe('https://ropewiki.com/RegionRowsTestOne');
        expect(r1.pageCount).toBe(10);

        const r2 = result.get(region2Id)!;
        expect(r2.id).toBe(region2Id);
        expect(r2.name).toBe('RegionRowsTestTwo');
        expect(r2.url).toBe('https://ropewiki.com/RegionRowsTestTwo');
        expect(r2.pageCount).toBe(3);
    });

    it('returns map keyed by region id', async () => {
        const result = await getRegionRowsByIds(conn, [region1Id]);
        expect(result.size).toBe(1);
        expect(result.get(region1Id)).toBeDefined();
        expect(result.get(region1Id)!.name).toBe('RegionRowsTestOne');
    });

    it('excludes deleted regions', async () => {
        const deletedId = 'd5000003-0003-4000-8000-000000000003';
        await db
            .insert('RopewikiRegion', {
                id: deletedId,
                parentRegion: null,
                name: 'RegionRowsDeleted',
                latestRevisionDate:
                    '2025-01-01T00:00:00' as db.TimestampString,
                pageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/RegionRowsDeleted',
                deletedAt: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);

        const result = await getRegionRowsByIds(conn, [deletedId]);
        expect(result.size).toBe(0);

        await db
            .sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(deletedId)}`.run(conn);
    });

    it('omits non-existent ids from result', async () => {
        const nonExistentId = 'a0000000-0000-0000-0000-000000000000';
        const result = await getRegionRowsByIds(conn, [
            region1Id,
            nonExistentId,
        ]);
        expect(result.size).toBe(1);
        expect(result.has(region1Id)).toBe(true);
        expect(result.has(nonExistentId)).toBe(false);
    });
});
