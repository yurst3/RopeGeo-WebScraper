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
import getPageRoutes from '../../../../src/api/getRoutePreview/database/getPageRoutes';
import { RopewikiRoute } from '../../../../src/types/pageRoute';

describe('getPageRoutes (integration)', () => {
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
        await db.sql`DELETE FROM "RopewikiRoute"`.run(conn);
        await db.sql`DELETE FROM "Route"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);

        await db
            .insert('RopewikiRegion', {
                id: testRegionId,
                parentRegion: null,
                name: 'Utah',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                pageCount: 0,
                level: 0,
                bestMonths: JSON.stringify([]),
                url: 'https://ropewiki.com/Utah',
            })
            .run(conn);
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "RopewikiRoute"`.run(conn);
        await db.sql`DELETE FROM "Route"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiRoute"`.run(conn);
        await db.sql`DELETE FROM "Route"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
        await pool.end();
    });

    it('returns empty array when route has no linked page routes', async () => {
        const routeId = '11111111-1111-1111-1111-111111111111';
        await db
            .insert('Route', {
                id: routeId,
                name: 'Orphan Route',
                type: 'Canyon',
                coordinates: { lat: 40.1, lon: -111.5 },
            })
            .run(conn);

        const result = await getPageRoutes(conn, routeId);

        expect(result).toEqual([]);
    });

    it('returns RopewikiRoute instances when route has linked pages', async () => {
        const routeId = '22222222-2222-2222-2222-222222222222';
        await db
            .insert('Route', {
                id: routeId,
                name: 'Test Route',
                type: 'Canyon',
                coordinates: { lat: 40.123, lon: -111.456 },
            })
            .run(conn);

        const pageId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: '728',
                name: 'Bear Creek Canyon',
                region: 'ffebfa80-656e-4e48-99a6-81608cc0051d',
                url: 'https://ropewiki.com/Bear_Creek_Canyon',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);

        await db
            .insert('RopewikiRoute', {
                route: routeId,
                ropewikiPage: pageId,
                mapData: null,
            })
            .run(conn);

        const result = await getPageRoutes(conn, routeId);

        expect(result.length).toBe(1);
        expect(result[0]).toBeInstanceOf(RopewikiRoute);
        expect((result[0] as RopewikiRoute).route).toBe(routeId);
        expect((result[0] as RopewikiRoute).page).toBe(pageId);
    });

    it('excludes deleted RopewikiRoute rows', async () => {
        const routeId = '33333333-3333-3333-3333-333333333333';
        await db
            .insert('Route', {
                id: routeId,
                name: 'Route',
                type: 'Cave',
                coordinates: { lat: 40.0, lon: -111.0 },
            })
            .run(conn);

        const pageId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: '5597',
                name: 'Devil Gulch',
                region: 'ffebfa80-656e-4e48-99a6-81608cc0051d',
                url: 'https://ropewiki.com/Devil_Gulch',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);

        await db
            .insert('RopewikiRoute', {
                route: routeId,
                ropewikiPage: pageId,
                mapData: null,
                deletedAt: new Date('2025-01-01T00:00:00Z'),
            })
            .run(conn);

        const result = await getPageRoutes(conn, routeId);

        expect(result).toEqual([]);
    });
});
