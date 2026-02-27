import { Pool } from 'pg';
import * as db from 'zapatos/db';
import { describe, it, expect, afterEach, beforeAll, afterAll } from '@jest/globals';
import getRoutesForPages from '../../../src/ropewiki/database/getRoutesForPages';
import RopewikiPage from '../../../src/ropewiki/types/page';
import { Route, RouteType } from 'ropegeo-common';

describe('getRoutesForPages (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;
    const testRegionId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
    const regionNameIds: {[name: string]: string} = { 'Test Region': testRegionId };

    beforeAll(async () => {
        // Clean tables
        await db.sql`DELETE FROM "RopewikiRoute"`.run(conn);
        await db.sql`DELETE FROM "Route"`.run(conn);
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

    it('returns routes for pages that have routes', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create pages
        const page1 = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['728'],
                name: ['Page 1'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Page_1'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        const page2 = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['5597'],
                name: ['Page 2'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Page_2'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        // Insert pages
        const dbRow1 = page1.toDbRow();
        const dbRow2 = page2.toDbRow();
        const inserted1 = await db.insert('RopewikiPage', dbRow1).run(conn);
        const inserted2 = await db.insert('RopewikiPage', dbRow2).run(conn);

        const page1Id = inserted1.id;
        const page2Id = inserted2.id;

        // Create routes
        const route1Id = '11111111-1111-1111-1111-111111111111';
        const route2Id = '22222222-2222-2222-2222-222222222222';

        await db
            .insert('Route', [
                {
                    id: route1Id,
                    name: 'Route 1',
                    type: 'Canyon',
                    coordinates: { lat: 40.123, lon: -111.456 },
                },
                {
                    id: route2Id,
                    name: 'Route 2',
                    type: 'Cave',
                    coordinates: { lat: 37.7749, lon: -122.4194 },
                },
            ])
            .run(conn);

        // Create RopewikiRoute entries
        await db
            .insert('RopewikiRoute', [
                {
                    route: route1Id,
                    ropewikiPage: page1Id,
                    mapData: null,
                },
                {
                    route: route2Id,
                    ropewikiPage: page2Id,
                    mapData: null,
                },
            ])
            .run(conn);

        // Fetch pages from database to get RopewikiPage objects with IDs
        const dbPages1 = await db.select('RopewikiPage', { id: page1Id }).run(conn);
        const dbPages2 = await db.select('RopewikiPage', { id: page2Id }).run(conn);
        const pages = [
            RopewikiPage.fromDbRow(dbPages1[0]!),
            RopewikiPage.fromDbRow(dbPages2[0]!),
        ];

        // Query for routes
        const results = await getRoutesForPages(conn, pages);

        expect(results).toHaveLength(2);
        
        // Check first page and route
        const [route1, resultPage1] = results[0]!;
        expect(resultPage1.id).toBe(page1Id);
        expect(route1).not.toBeNull();
        expect(route1!.id).toBe(route1Id);
        expect(route1!.name).toBe('Route 1');
        expect(route1!.type).toBe(RouteType.Canyon);
        expect(route1!.coordinates).toEqual({ lat: 40.123, lon: -111.456 });

        // Check second page and route
        const [route2, resultPage2] = results[1]!;
        expect(resultPage2.id).toBe(page2Id);
        expect(route2).not.toBeNull();
        expect(route2!.id).toBe(route2Id);
        expect(route2!.name).toBe('Route 2');
        expect(route2!.type).toBe(RouteType.Cave);
        expect(route2!.coordinates).toEqual({ lat: 37.7749, lon: -122.4194 });
    });

    it('returns null routes for pages without routes', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create page with route
        const pageWithRoute = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['728'],
                name: ['Page With Route'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Page_With_Route'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        // Create page without route
        const pageWithoutRoute = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['5597'],
                name: ['Page Without Route'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Page_Without_Route'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        // Insert pages
        const dbRowWithRoute = pageWithRoute.toDbRow();
        const dbRowWithoutRoute = pageWithoutRoute.toDbRow();
        const insertedWithRoute = await db.insert('RopewikiPage', dbRowWithRoute).run(conn);
        const insertedWithoutRoute = await db.insert('RopewikiPage', dbRowWithoutRoute).run(conn);

        const pageWithRouteId = insertedWithRoute.id;
        const pageWithoutRouteId = insertedWithoutRoute.id;

        // Create route
        const routeId = '11111111-1111-1111-1111-111111111111';
        await db
            .insert('Route', {
                id: routeId,
                name: 'Route 1',
                type: 'Canyon',
                coordinates: { lat: 40.123, lon: -111.456 },
            })
            .run(conn);

        // Create RopewikiRoute entry only for pageWithRoute
        await db
            .insert('RopewikiRoute', {
                route: routeId,
                ropewikiPage: pageWithRouteId,
                mapData: null,
            })
            .run(conn);

        // Fetch pages from database to get RopewikiPage objects with IDs
        const dbPagesWithRoute = await db.select('RopewikiPage', { id: pageWithRouteId }).run(conn);
        const dbPagesWithoutRoute = await db.select('RopewikiPage', { id: pageWithoutRouteId }).run(conn);
        const pages = [
            RopewikiPage.fromDbRow(dbPagesWithRoute[0]!),
            RopewikiPage.fromDbRow(dbPagesWithoutRoute[0]!),
        ];

        // Query for routes
        const results = await getRoutesForPages(conn, pages);

        expect(results).toHaveLength(2);
        
        // Check page with route
        const [route1, resultPage1] = results[0]!;
        expect(resultPage1.id).toBe(pageWithRouteId);
        expect(route1).not.toBeNull();
        expect(route1!.id).toBe(routeId);

        // Check page without route
        const [route2, resultPage2] = results[1]!;
        expect(resultPage2.id).toBe(pageWithoutRouteId);
        expect(route2).toBeNull();
    });

    it('returns empty array when no pages provided', async () => {
        const results = await getRoutesForPages(conn, []);

        expect(results).toHaveLength(0);
    });

    it('returns null routes for pages without IDs', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create page without ID (from constructor)
        const page = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['728'],
                name: ['Page Without ID'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Page_Without_ID'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        const results = await getRoutesForPages(conn, [page]);

        expect(results).toHaveLength(1);
        const [route, resultPage] = results[0]!;
        expect(resultPage).toBe(page);
        expect(route).toBeNull();
    });

    it('returns null routes when all pages have no routes', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create page without route
        const page = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['728'],
                name: ['Page Without Route'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Page_Without_Route'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        // Insert page
        const dbRow = page.toDbRow();
        const inserted = await db.insert('RopewikiPage', dbRow).run(conn);
        const pageId = inserted.id;

        // Fetch page from database to get RopewikiPage object with ID
        const dbPages = await db.select('RopewikiPage', { id: pageId }).run(conn);
        const pages = [RopewikiPage.fromDbRow(dbPages[0]!)];

        // Query for routes
        const results = await getRoutesForPages(conn, pages);

        expect(results).toHaveLength(1);
        const [route, resultPage] = results[0]!;
        expect(resultPage.id).toBe(pageId);
        expect(route).toBeNull();
    });

    it('filters out deleted routes', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create page
        const page = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['728'],
                name: ['Page With Deleted Route'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Page_With_Deleted_Route'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        // Insert page
        const dbRow = page.toDbRow();
        const inserted = await db.insert('RopewikiPage', dbRow).run(conn);
        const pageId = inserted.id;

        // Create route
        const routeId = '11111111-1111-1111-1111-111111111111';
        await db
            .insert('Route', {
                id: routeId,
                name: 'Route 1',
                type: 'Canyon',
                coordinates: { lat: 40.123, lon: -111.456 },
            })
            .run(conn);

        // Create RopewikiRoute entry and then mark it as deleted
        await db
            .insert('RopewikiRoute', {
                route: routeId,
                ropewikiPage: pageId,
                mapData: null,
            })
            .run(conn);

        const now = new Date();
        await db
            .update('RopewikiRoute', { deletedAt: now }, { route: routeId, ropewikiPage: pageId })
            .run(conn);

        // Fetch page from database to get RopewikiPage object with ID
        const dbPages = await db.select('RopewikiPage', { id: pageId }).run(conn);
        const pages = [RopewikiPage.fromDbRow(dbPages[0]!)];

        // Query for routes
        const results = await getRoutesForPages(conn, pages);

        expect(results).toHaveLength(1);
        const [route, resultPage] = results[0]!;
        expect(resultPage.id).toBe(pageId);
        expect(route).toBeNull();
    });

    it('preserves the order of input pages', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create three pages
        const page1 = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['728'],
                name: ['Page 1'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Page_1'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        const page2 = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['5597'],
                name: ['Page 2'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Page_2'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        const page3 = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['9999'],
                name: ['Page 3'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Page_3'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        // Insert pages
        const inserted1 = await db.insert('RopewikiPage', page1.toDbRow()).run(conn);
        const inserted2 = await db.select('RopewikiPage', { id: inserted1.id }).run(conn);
        const inserted3 = await db.insert('RopewikiPage', page2.toDbRow()).run(conn);
        const inserted4 = await db.select('RopewikiPage', { id: inserted3.id }).run(conn);
        const inserted5 = await db.insert('RopewikiPage', page3.toDbRow()).run(conn);
        const inserted6 = await db.select('RopewikiPage', { id: inserted5.id }).run(conn);

        const page1Id = inserted1.id;
        const page2Id = inserted3.id;
        const page3Id = inserted5.id;

        // Create route only for page2
        const routeId = '11111111-1111-1111-1111-111111111111';
        await db
            .insert('Route', {
                id: routeId,
                name: 'Route 1',
                type: 'Canyon',
                coordinates: { lat: 40.123, lon: -111.456 },
            })
            .run(conn);

        await db
            .insert('RopewikiRoute', {
                route: routeId,
                ropewikiPage: page2Id,
                mapData: null,
            })
            .run(conn);

        // Fetch pages from database
        const dbPages1 = await db.select('RopewikiPage', { id: page1Id }).run(conn);
        const dbPages2 = await db.select('RopewikiPage', { id: page2Id }).run(conn);
        const dbPages3 = await db.select('RopewikiPage', { id: page3Id }).run(conn);
        const pages = [
            RopewikiPage.fromDbRow(dbPages1[0]!),
            RopewikiPage.fromDbRow(dbPages2[0]!),
            RopewikiPage.fromDbRow(dbPages3[0]!),
        ];

        // Query for routes
        const results = await getRoutesForPages(conn, pages);

        expect(results).toHaveLength(3);
        
        // Verify order is preserved
        expect(results[0]![1].id).toBe(page1Id);
        expect(results[0]![0]).toBeNull();
        
        expect(results[1]![1].id).toBe(page2Id);
        expect(results[1]![0]).not.toBeNull();
        expect(results[1]![0]!.id).toBe(routeId);
        
        expect(results[2]![1].id).toBe(page3Id);
        expect(results[2]![0]).toBeNull();
    });

    it('handles mixed scenarios with some pages having routes and some not', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create pages
        const page1 = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['728'],
                name: ['Page 1'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Page_1'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        const page2 = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['5597'],
                name: ['Page 2'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Page_2'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        const page3 = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['9999'],
                name: ['Page 3'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Page_3'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        // Insert pages
        const inserted1 = await db.insert('RopewikiPage', page1.toDbRow()).run(conn);
        const inserted2 = await db.insert('RopewikiPage', page2.toDbRow()).run(conn);
        const inserted3 = await db.insert('RopewikiPage', page3.toDbRow()).run(conn);

        const page1Id = inserted1.id;
        const page2Id = inserted2.id;
        const page3Id = inserted3.id;

        // Create routes
        const route1Id = '11111111-1111-1111-1111-111111111111';
        const route2Id = '22222222-2222-2222-2222-222222222222';

        await db
            .insert('Route', [
                {
                    id: route1Id,
                    name: 'Route 1',
                    type: 'Canyon',
                    coordinates: { lat: 40.123, lon: -111.456 },
                },
                {
                    id: route2Id,
                    name: 'Route 2',
                    type: 'POI',
                    coordinates: { lat: 37.7749, lon: -122.4194 },
                },
            ])
            .run(conn);

        // Create RopewikiRoute entries only for page1 and page3
        await db
            .insert('RopewikiRoute', [
                {
                    route: route1Id,
                    ropewikiPage: page1Id,
                    mapData: null,
                },
                {
                    route: route2Id,
                    ropewikiPage: page3Id,
                    mapData: null,
                },
            ])
            .run(conn);

        // Fetch pages from database
        const dbPages1 = await db.select('RopewikiPage', { id: page1Id }).run(conn);
        const dbPages2 = await db.select('RopewikiPage', { id: page2Id }).run(conn);
        const dbPages3 = await db.select('RopewikiPage', { id: page3Id }).run(conn);
        const pages = [
            RopewikiPage.fromDbRow(dbPages1[0]!),
            RopewikiPage.fromDbRow(dbPages2[0]!),
            RopewikiPage.fromDbRow(dbPages3[0]!),
        ];

        // Query for routes
        const results = await getRoutesForPages(conn, pages);

        expect(results).toHaveLength(3);
        
        // Page 1 has route
        expect(results[0]![1].id).toBe(page1Id);
        expect(results[0]![0]).not.toBeNull();
        expect(results[0]![0]!.id).toBe(route1Id);
        expect(results[0]![0]!.type).toBe(RouteType.Canyon);
        
        // Page 2 has no route
        expect(results[1]![1].id).toBe(page2Id);
        expect(results[1]![0]).toBeNull();
        
        // Page 3 has route
        expect(results[2]![1].id).toBe(page3Id);
        expect(results[2]![0]).not.toBeNull();
        expect(results[2]![0]!.id).toBe(route2Id);
        expect(results[2]![0]!.type).toBe(RouteType.POI);
    });

    it('handles all RouteType values correctly', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create page
        const page = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['728'],
                name: ['Test Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Test_Page'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        // Insert page
        const inserted = await db.insert('RopewikiPage', page.toDbRow()).run(conn);
        const pageId = inserted.id;

        // Test each RouteType
        const routeTypes = [RouteType.Canyon, RouteType.Cave, RouteType.POI, RouteType.Unknown];
        
        for (const routeType of routeTypes) {
            // Clean previous route
            await db.sql`DELETE FROM "RopewikiRoute"`.run(conn);
            await db.sql`DELETE FROM "Route"`.run(conn);

            // Create route with specific type
            const routeId = `11111111-1111-1111-1111-111111111111`;
            await db
                .insert('Route', {
                    id: routeId,
                    name: `Route ${routeType}`,
                    type: routeType,
                    coordinates: { lat: 40.123, lon: -111.456 },
                })
                .run(conn);

            await db
                .insert('RopewikiRoute', {
                    route: routeId,
                    ropewikiPage: pageId,
                    mapData: null,
                })
                .run(conn);

            // Fetch page from database
            const dbPages = await db.select('RopewikiPage', { id: pageId }).run(conn);
            const pages = [RopewikiPage.fromDbRow(dbPages[0]!)];

            // Query for routes
            const results = await getRoutesForPages(conn, pages);

            expect(results).toHaveLength(1);
            const [route] = results[0]!;
            expect(route).not.toBeNull();
            expect(route!.type).toBe(routeType);
        }
    });
});
