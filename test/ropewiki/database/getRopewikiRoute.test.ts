import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import getRopewikiRoute from '../../../src/ropewiki/database/getRopewikiRoute';
import { RopewikiRoute } from '../../../src/types/pageRoute';

describe('getRopewikiRoute (integration)', () => {
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
        await db.sql`DELETE FROM "RopewikiRoute"`.run(conn);
        await db.sql`DELETE FROM "Route"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
        await db.sql`DELETE FROM "MapData"`.run(conn);
    });

    afterEach(async () => {
        // Clean between tests
        await db.sql`DELETE FROM "RopewikiRoute"`.run(conn);
        await db.sql`DELETE FROM "Route"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
        await db.sql`DELETE FROM "MapData"`.run(conn);
    });

    afterAll(async () => {
        await pool.end();
    });

    it('returns a RopewikiRoute object when the route-page link exists with mapData', async () => {
        const regionId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
        const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';
        const routeId = '11111111-1111-1111-1111-111111111111';
        const mapDataId = '22222222-2222-2222-2222-222222222222';
        const latestRevisionDate = '2025-01-01T00:00:00' as db.TimestampString;

        // Insert a region first (required foreign key)
        await db
            .insert('RopewikiRegion', [
                {
                    id: regionId,
                    parentRegion: null,
                    name: 'Test Region',
                    latestRevisionDate,
                    pageCount: 1,
                    level: 0,
                    overview: null,
                    bestMonths: JSON.stringify([]),
                    isMajorRegion: false,
                    isTopLevelRegion: true,
                    url: 'https://ropewiki.com/Test_Region',
                },
            ])
            .run(conn);

        // Insert a page
        await db
            .insert('RopewikiPage', [
                {
                    id: pageId,
                    pageId: '12345',
                    name: 'Test Page',
                    region: regionId,
                    url: 'https://ropewiki.com/Test_Page',
                    latestRevisionDate,
                },
            ])
            .run(conn);

        // Insert a route
        await db
            .insert('Route', [
                {
                    id: routeId,
                    name: 'Test Route',
                    type: 'Canyon',
                    coordinates: { lat: 40.123, lon: -111.456 },
                },
            ])
            .run(conn);

        // Insert a MapData record (required for foreign key)
        await db
            .insert('MapData', [
                {
                    id: mapDataId,
                    gpxUrl: null,
                    kmlUrl: null,
                    geoJsonUrl: null,
                    vectorTileUrl: null,
                },
            ])
            .run(conn);

        // Insert a RopewikiRoute with mapData
        await db
            .insert('RopewikiRoute', [
                {
                    route: routeId,
                    ropewikiPage: pageId,
                    mapData: mapDataId,
                },
            ])
            .run(conn);

        const result = await getRopewikiRoute(conn, routeId, pageId);

        expect(result).toBeDefined();
        expect(result).toBeInstanceOf(RopewikiRoute);
        expect(result!.route).toBe(routeId);
        expect(result!.ropewikiPage).toBe(pageId);
        expect(result!.mapData).toBe(mapDataId);
    });

    it('returns a RopewikiRoute object when the route-page link exists without mapData', async () => {
        const regionId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
        const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';
        const routeId = '11111111-1111-1111-1111-111111111111';
        const latestRevisionDate = '2025-01-01T00:00:00' as db.TimestampString;

        // Insert a region first (required foreign key)
        await db
            .insert('RopewikiRegion', [
                {
                    id: regionId,
                    parentRegion: null,
                    name: 'Test Region',
                    latestRevisionDate,
                    pageCount: 1,
                    level: 0,
                    overview: null,
                    bestMonths: JSON.stringify([]),
                    isMajorRegion: false,
                    isTopLevelRegion: true,
                    url: 'https://ropewiki.com/Test_Region',
                },
            ])
            .run(conn);

        // Insert a page
        await db
            .insert('RopewikiPage', [
                {
                    id: pageId,
                    pageId: '12345',
                    name: 'Test Page',
                    region: regionId,
                    url: 'https://ropewiki.com/Test_Page',
                    latestRevisionDate,
                },
            ])
            .run(conn);

        // Insert a route
        await db
            .insert('Route', [
                {
                    id: routeId,
                    name: 'Test Route',
                    type: 'Canyon',
                    coordinates: { lat: 40.123, lon: -111.456 },
                },
            ])
            .run(conn);

        // Insert a RopewikiRoute without mapData
        await db
            .insert('RopewikiRoute', [
                {
                    route: routeId,
                    ropewikiPage: pageId,
                    mapData: null,
                },
            ])
            .run(conn);

        const result = await getRopewikiRoute(conn, routeId, pageId);

        expect(result).toBeDefined();
        expect(result).toBeInstanceOf(RopewikiRoute);
        expect(result!.route).toBe(routeId);
        expect(result!.ropewikiPage).toBe(pageId);
        expect(result!.mapData).toBeUndefined();
    });

    it('returns undefined when the route-page link does not exist', async () => {
        const routeId = '11111111-1111-1111-1111-111111111111';
        const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';

        const result = await getRopewikiRoute(conn, routeId, pageId);

        expect(result).toBeUndefined();
    });

    it('returns undefined when the route-page link is deleted', async () => {
        const regionId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
        const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';
        const routeId = '11111111-1111-1111-1111-111111111111';
        const mapDataId = '22222222-2222-2222-2222-222222222222';
        const latestRevisionDate = '2025-01-01T00:00:00' as db.TimestampString;

        // Insert a region first (required foreign key)
        await db
            .insert('RopewikiRegion', [
                {
                    id: regionId,
                    parentRegion: null,
                    name: 'Test Region',
                    latestRevisionDate,
                    pageCount: 1,
                    level: 0,
                    overview: null,
                    bestMonths: JSON.stringify([]),
                    isMajorRegion: false,
                    isTopLevelRegion: true,
                    url: 'https://ropewiki.com/Test_Region',
                },
            ])
            .run(conn);

        // Insert a page
        await db
            .insert('RopewikiPage', [
                {
                    id: pageId,
                    pageId: '12345',
                    name: 'Test Page',
                    region: regionId,
                    url: 'https://ropewiki.com/Test_Page',
                    latestRevisionDate,
                },
            ])
            .run(conn);

        // Insert a route
        await db
            .insert('Route', [
                {
                    id: routeId,
                    name: 'Test Route',
                    type: 'Canyon',
                    coordinates: { lat: 40.123, lon: -111.456 },
                },
            ])
            .run(conn);

        // Insert a MapData record (required for foreign key)
        await db
            .insert('MapData', [
                {
                    id: mapDataId,
                    gpxUrl: null,
                    kmlUrl: null,
                    geoJsonUrl: null,
                    vectorTileUrl: null,
                },
            ])
            .run(conn);

        // Insert a RopewikiRoute with mapData and mark it as deleted
        await db
            .insert('RopewikiRoute', [
                {
                    route: routeId,
                    ropewikiPage: pageId,
                    mapData: mapDataId,
                    deletedAt: new Date(),
                },
            ])
            .run(conn);

        const result = await getRopewikiRoute(conn, routeId, pageId);

        expect(result).toBeUndefined();
    });

    it('returns the correct RopewikiRoute when multiple route-page links exist', async () => {
        const regionId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
        const pageId1 = 'd1d9139d-38db-433c-b7cd-a28f79331667';
        const pageId2 = 'e2e9240e-49ec-544d-c8de-b39f90442778';
        const routeId1 = '11111111-1111-1111-1111-111111111111';
        const routeId2 = '33333333-3333-3333-3333-333333333333';
        const mapDataId1 = '22222222-2222-2222-2222-222222222222';
        const mapDataId2 = '44444444-4444-4444-4444-444444444444';
        const latestRevisionDate = '2025-01-01T00:00:00' as db.TimestampString;

        // Insert a region first (required foreign key)
        await db
            .insert('RopewikiRegion', [
                {
                    id: regionId,
                    parentRegion: null,
                    name: 'Test Region',
                    latestRevisionDate,
                    pageCount: 2,
                    level: 0,
                    overview: null,
                    bestMonths: JSON.stringify([]),
                    isMajorRegion: false,
                    isTopLevelRegion: true,
                    url: 'https://ropewiki.com/Test_Region',
                },
            ])
            .run(conn);

        // Insert pages
        await db
            .insert('RopewikiPage', [
                {
                    id: pageId1,
                    pageId: '12345',
                    name: 'Test Page 1',
                    region: regionId,
                    url: 'https://ropewiki.com/Test_Page_1',
                    latestRevisionDate,
                },
                {
                    id: pageId2,
                    pageId: '67890',
                    name: 'Test Page 2',
                    region: regionId,
                    url: 'https://ropewiki.com/Test_Page_2',
                    latestRevisionDate,
                },
            ])
            .run(conn);

        // Insert routes
        await db
            .insert('Route', [
                {
                    id: routeId1,
                    name: 'Test Route 1',
                    type: 'Canyon',
                    coordinates: { lat: 40.123, lon: -111.456 },
                },
                {
                    id: routeId2,
                    name: 'Test Route 2',
                    type: 'Canyon',
                    coordinates: { lat: 37.7749, lon: -122.4194 },
                },
            ])
            .run(conn);

        // Insert MapData records (required for foreign keys)
        await db
            .insert('MapData', [
                {
                    id: mapDataId1,
                    gpxUrl: null,
                    kmlUrl: null,
                    geoJsonUrl: null,
                    vectorTileUrl: null,
                },
                {
                    id: mapDataId2,
                    gpxUrl: null,
                    kmlUrl: null,
                    geoJsonUrl: null,
                    vectorTileUrl: null,
                },
            ])
            .run(conn);

        // Insert RopewikiRoute links
        await db
            .insert('RopewikiRoute', [
                {
                    route: routeId1,
                    ropewikiPage: pageId1,
                    mapData: mapDataId1,
                },
                {
                    route: routeId2,
                    ropewikiPage: pageId2,
                    mapData: mapDataId2,
                },
            ])
            .run(conn);

        const result1 = await getRopewikiRoute(conn, routeId1, pageId1);
        const result2 = await getRopewikiRoute(conn, routeId2, pageId2);

        expect(result1).toBeDefined();
        expect(result1).toBeInstanceOf(RopewikiRoute);
        expect(result1!.route).toBe(routeId1);
        expect(result1!.ropewikiPage).toBe(pageId1);
        expect(result1!.mapData).toBe(mapDataId1);

        expect(result2).toBeDefined();
        expect(result2).toBeInstanceOf(RopewikiRoute);
        expect(result2!.route).toBe(routeId2);
        expect(result2!.ropewikiPage).toBe(pageId2);
        expect(result2!.mapData).toBe(mapDataId2);
    });

    it('propagates errors from the database layer', async () => {
        const badPool = new Pool({
            user: process.env.TEST_USER,
            password: process.env.TEST_PASS,
            host: process.env.TEST_HOST,
            port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
            database: 'nonexistent_database_for_test_error_get_ropewiki_route',
        });

        await expect(getRopewikiRoute(badPool, '11111111-1111-1111-1111-111111111111', 'd1d9139d-38db-433c-b7cd-a28f79331667')).rejects.toBeDefined();

        await badPool.end();
    });
});
