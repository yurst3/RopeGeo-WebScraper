import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as db from 'zapatos/db';
import getAllowedRegionIds from '../../../../src/api/search/database/getAllowedRegionIds';

describe('getAllowedRegionIds (integration)', () => {
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

    const rootId = 'd3000001-0001-4000-8000-000000000001';
    const childId = 'd3000002-0002-4000-8000-000000000002';
    const grandchildId = 'd3000003-0003-4000-8000-000000000003';

    beforeAll(async () => {
        await db
            .insert('RopewikiRegion', {
                id: rootId,
                parentRegion: null,
                name: 'AllowedIdsRoot',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                pageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/AllowedIdsRoot',
            })
            .run(conn);
        await db
            .insert('RopewikiRegion', {
                id: childId,
                parentRegion: rootId,
                name: 'AllowedIdsChild',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                pageCount: 0,
                level: 1,
                bestMonths: [],
                url: 'https://ropewiki.com/AllowedIdsChild',
            })
            .run(conn);
        await db
            .insert('RopewikiRegion', {
                id: grandchildId,
                parentRegion: childId,
                name: 'AllowedIdsGrandchild',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                pageCount: 0,
                level: 2,
                bestMonths: [],
                url: 'https://ropewiki.com/AllowedIdsGrandchild',
            })
            .run(conn);
    });

    afterAll(async () => {
        await db
            .sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(grandchildId)}`.run(conn);
        await db
            .sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(childId)}`.run(conn);
        await db
            .sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(rootId)}`.run(conn);
        await pool.end();
    });

    it('when regionId is null, returns all non-deleted region ids', async () => {
        const result = await getAllowedRegionIds(conn, null);
        expect(result.length).toBeGreaterThanOrEqual(3);
        expect(result).toContain(rootId);
        expect(result).toContain(childId);
        expect(result).toContain(grandchildId);
    });

    it('when regionId is root, returns root and all descendants', async () => {
        const result = await getAllowedRegionIds(conn, rootId);
        expect(result).toEqual(
            expect.arrayContaining([rootId, childId, grandchildId]),
        );
        expect(result.length).toBe(3);
    });

    it('when regionId is child, returns child and grandchild only', async () => {
        const result = await getAllowedRegionIds(conn, childId);
        expect(result).toEqual(
            expect.arrayContaining([childId, grandchildId]),
        );
        expect(result.length).toBe(2);
    });

    it('when regionId is leaf region, returns only that region', async () => {
        const result = await getAllowedRegionIds(conn, grandchildId);
        expect(result).toEqual([grandchildId]);
    });

    it('when regionId is non-existent uuid, returns empty array', async () => {
        const result = await getAllowedRegionIds(
            conn,
            'a0000000-0000-0000-0000-000000000000',
        );
        expect(result).toEqual([]);
    });
});
