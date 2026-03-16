import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import upsertRopewikiRoute from '../../../src/ropewiki/database/upsertRopewikiRoute';
import { RopewikiRoute } from '../../../src/types/pageRoute';

describe('upsertRopewikiRoute (integration)', () => {
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

    it('inserts a new RopewikiRoute record when it does not exist', async () => {
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
                    gpx: null,
                    kml: null,
                    geoJson: null,
                    tiles: null,
                },
            ])
            .run(conn);

        // Upsert the RopewikiRoute
        const ropewikiRoute = new RopewikiRoute(routeId, pageId, mapDataId);
        await upsertRopewikiRoute(conn, ropewikiRoute);

        // Verify it was inserted
        const dbRow = await db.selectOne('RopewikiRoute', {
            route: routeId,
            ropewikiPage: pageId,
        }).run(conn);

        expect(dbRow).toBeDefined();
        expect(dbRow!.route).toBe(routeId);
        expect(dbRow!.ropewikiPage).toBe(pageId);
        expect(dbRow!.mapData).toBe(mapDataId);
        expect(dbRow!.deletedAt).toBeNull();
    });

    it('inserts a new RopewikiRoute record without mapData when mapDataId is not provided', async () => {
        const regionId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
        const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';
        const routeId = '11111111-1111-1111-1111-111111111111';
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

        // Upsert the RopewikiRoute without mapData
        const ropewikiRoute = new RopewikiRoute(routeId, pageId);
        await upsertRopewikiRoute(conn, ropewikiRoute);

        // Verify it was inserted
        const dbRow = await db.selectOne('RopewikiRoute', {
            route: routeId,
            ropewikiPage: pageId,
        }).run(conn);

        expect(dbRow).toBeDefined();
        expect(dbRow!.route).toBe(routeId);
        expect(dbRow!.ropewikiPage).toBe(pageId);
        expect(dbRow!.mapData).toBeNull();
        expect(dbRow!.deletedAt).toBeNull();
    });

    it('updates an existing RopewikiRoute record when it already exists', async () => {
        const regionId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
        const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';
        const routeId = '11111111-1111-1111-1111-111111111111';
        const mapDataId1 = '22222222-2222-2222-2222-222222222222';
        const mapDataId2 = '33333333-3333-3333-3333-333333333333';
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

        // Insert MapData records (required for foreign keys)
        await db
            .insert('MapData', [
                {
                    id: mapDataId1,
                    gpx: null,
                    kml: null,
                    geoJson: null,
                    tiles: null,
                },
                {
                    id: mapDataId2,
                    gpx: null,
                    kml: null,
                    geoJson: null,
                    tiles: null,
                },
            ])
            .run(conn);

        // Insert initial RopewikiRoute with mapDataId1
        const ropewikiRoute1 = new RopewikiRoute(routeId, pageId, mapDataId1);
        await upsertRopewikiRoute(conn, ropewikiRoute1);

        // Get initial updatedAt
        const initialDbRow = await db.selectOne('RopewikiRoute', {
            route: routeId,
            ropewikiPage: pageId,
        }).run(conn);
        const initialUpdatedAt = new Date(initialDbRow!.updatedAt);

        // Wait a bit to ensure updatedAt changes
        await new Promise(resolve => setTimeout(resolve, 10));

        // Update with mapDataId2
        const ropewikiRoute2 = new RopewikiRoute(routeId, pageId, mapDataId2);
        await upsertRopewikiRoute(conn, ropewikiRoute2);

        // Verify it was updated
        const updatedDbRow = await db.selectOne('RopewikiRoute', {
            route: routeId,
            ropewikiPage: pageId,
        }).run(conn);

        expect(updatedDbRow).toBeDefined();
        expect(updatedDbRow!.mapData).toBe(mapDataId2);
        expect(updatedDbRow!.deletedAt).toBeNull();
        
        // Verify updatedAt was updated
        const updatedUpdatedAt = new Date(updatedDbRow!.updatedAt);
        expect(updatedUpdatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
    });

    it('clears deletedAt when updating an existing deleted record', async () => {
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
                    gpx: null,
                    kml: null,
                    geoJson: null,
                    tiles: null,
                },
            ])
            .run(conn);

        // Insert initial RopewikiRoute and mark it as deleted
        await db
            .insert('RopewikiRoute', [
                {
                    route: routeId,
                    ropewikiPage: pageId,
                    mapData: null,
                    deletedAt: new Date(),
                },
            ])
            .run(conn);

        // Upsert should clear deletedAt
        const ropewikiRoute = new RopewikiRoute(routeId, pageId, mapDataId);
        await upsertRopewikiRoute(conn, ropewikiRoute);

        // Verify deletedAt was cleared
        const dbRow = await db.selectOne('RopewikiRoute', {
            route: routeId,
            ropewikiPage: pageId,
        }).run(conn);

        expect(dbRow).toBeDefined();
        expect(dbRow!.deletedAt).toBeNull();
        expect(dbRow!.mapData).toBe(mapDataId);
    });

    it('updates mapData to null when mapDataId is null', async () => {
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
                    gpx: null,
                    kml: null,
                    geoJson: null,
                    tiles: null,
                },
            ])
            .run(conn);

        // Insert initial RopewikiRoute with mapData
        const ropewikiRoute1 = new RopewikiRoute(routeId, pageId, mapDataId);
        await upsertRopewikiRoute(conn, ropewikiRoute1);

        // Update with null mapData
        const ropewikiRoute2 = new RopewikiRoute(routeId, pageId);
        await upsertRopewikiRoute(conn, ropewikiRoute2);

        // Verify mapData was set to null
        const dbRow = await db.selectOne('RopewikiRoute', {
            route: routeId,
            ropewikiPage: pageId,
        }).run(conn);

        expect(dbRow).toBeDefined();
        expect(dbRow!.mapData).toBeNull();
    });

    it('propagates errors from the database layer', async () => {
        const badPool = new Pool({
            user: process.env.TEST_USER,
            password: process.env.TEST_PASS,
            host: process.env.TEST_HOST,
            port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
            database: 'nonexistent_database_for_test_error_upsert_ropewiki_route',
        });

        const ropewikiRoute = new RopewikiRoute('11111111-1111-1111-1111-111111111111', 'd1d9139d-38db-433c-b7cd-a28f79331667');
        await expect(upsertRopewikiRoute(badPool, ropewikiRoute)).rejects.toBeDefined();

        await badPool.end();
    });
});
