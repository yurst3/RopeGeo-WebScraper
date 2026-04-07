import { Pool } from 'pg';
import * as db from 'zapatos/db';
import { describe, it, expect, afterEach, beforeAll, afterAll } from '@jest/globals';
import insertMissingRoutes from '../../../src/ropewiki/database/insertMissingRoutes';
import RopewikiPage from '../../../src/ropewiki/types/page';
import { Route, RouteType } from 'ropegeo-common/models';

describe('insertMissingRoutes (integration)', () => {
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
        await db.sql`DELETE FROM "RopewikiRoute"`.run(conn);
        await db.sql`DELETE FROM "Route"`.run(conn);
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

    it('inserts routes for pages without routes', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create pages
        const page1 = new RopewikiPage(
            '728',
            'Bear Creek Canyon',
            testRegionId,
            'https://ropewiki.com/Bear_Creek_Canyon',
            latestRevisionDate,
            { lat: 40.123, lon: -111.456 },
            undefined,
            '5.10a',
        );

        const page2 = new RopewikiPage(
            '5597',
            'Test Page 2',
            testRegionId,
            'https://ropewiki.com/Test_Page_2',
            latestRevisionDate,
            { lat: 37.7749, lon: -122.4194 },
            undefined,
            '5.9',
        );

        // Insert pages
        const dbRow1 = page1.toDbRow();
        const dbRow2 = page2.toDbRow();
        const inserted1 = await db.insert('RopewikiPage', dbRow1).run(conn);
        const inserted2 = await db.insert('RopewikiPage', dbRow2).run(conn);

        const page1Id = inserted1.id;
        const page2Id = inserted2.id;

        // Fetch pages from database to get RopewikiPage objects with IDs
        const dbPages1 = await db.select('RopewikiPage', { id: page1Id }).run(conn);
        const dbPages2 = await db.select('RopewikiPage', { id: page2Id }).run(conn);
        const pages = [
            RopewikiPage.fromDbRow(dbPages1[0]!),
            RopewikiPage.fromDbRow(dbPages2[0]!),
        ];

        // Call insertMissingRoutes with null routes
        const routesAndPages: Array<[Route | null, RopewikiPage]> = [
            [null, pages[0]!],
            [null, pages[1]!],
        ];

        const result = await insertMissingRoutes(conn, routesAndPages);

        expect(result).toHaveLength(2);
        
        // Check first page and route
        const [route1, resultPage1] = result[0]!;
        expect(resultPage1.id).toBe(page1Id);
        expect(route1).not.toBeNull();
        expect(route1.id).toBeDefined();
        expect(route1.name).toBe('Bear Creek Canyon');
        expect(route1.type).toBe(RouteType.Canyon);
        expect(route1.coordinates).toEqual({ lat: 40.123, lon: -111.456 });

        // Check second page and route
        const [route2, resultPage2] = result[1]!;
        expect(resultPage2.id).toBe(page2Id);
        expect(route2).not.toBeNull();
        expect(route2.id).toBeDefined();
        expect(route2.name).toBe('Test Page 2');
        expect(route2.type).toBe(RouteType.Canyon);
        expect(route2.coordinates).toEqual({ lat: 37.7749, lon: -122.4194 });

        // Verify routes were inserted into database
        const dbRoute1 = await db.selectOne('Route', { id: route1.id }).run(conn);
        const dbRoute2 = await db.selectOne('Route', { id: route2.id }).run(conn);

        expect(dbRoute1).toBeDefined();
        expect(dbRoute1!.name).toBe('Bear Creek Canyon');
        expect(dbRoute2).toBeDefined();
        expect(dbRoute2!.name).toBe('Test Page 2');
    });

    it('returns existing routes unchanged when all pages have routes', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create page
        const page = new RopewikiPage(
            '728',
            'Test Page',
            testRegionId,
            'https://ropewiki.com/Test_Page',
            latestRevisionDate,
            { lat: 40.123, lon: -111.456 },
            undefined,
            '5.10a',
        );

        // Insert page
        const dbRow = page.toDbRow();
        const inserted = await db.insert('RopewikiPage', dbRow).run(conn);
        const pageId = inserted.id;

        // Create existing route
        const existingRouteId = '11111111-1111-1111-1111-111111111111';
        await db
            .insert('Route', {
                id: existingRouteId,
                name: 'Existing Route',
                type: 'Canyon',
                coordinates: { lat: 37.7749, lon: -122.4194 },
            })
            .run(conn);

        // Fetch page from database
        const dbPages = await db.select('RopewikiPage', { id: pageId }).run(conn);
        const dbPage = RopewikiPage.fromDbRow(dbPages[0]!);

        // Create existing Route object
        const existingRoute = new Route(
            existingRouteId,
            'Existing Route',
            RouteType.Canyon,
            { lat: 37.7749, lon: -122.4194 },
        );

        // Call insertMissingRoutes with existing route
        const routesAndPages: Array<[Route | null, RopewikiPage]> = [
            [existingRoute, dbPage],
        ];

        const result = await insertMissingRoutes(conn, routesAndPages);

        expect(result).toHaveLength(1);
        const [route, resultPage] = result[0]!;
        expect(resultPage.id).toBe(pageId);
        expect(route).toBe(existingRoute);
        expect(route.id).toBe(existingRouteId);
        expect(route.name).toBe('Existing Route');
    });

    it('handles mixed scenario with some pages having routes and some not', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create pages
        const page1 = new RopewikiPage(
            '728',
            'Page 1',
            testRegionId,
            'https://ropewiki.com/Page_1',
            latestRevisionDate,
            { lat: 40.123, lon: -111.456 },
            undefined,
            '5.10a',
        );

        const page2 = new RopewikiPage(
            '5597',
            'Page 2',
            testRegionId,
            'https://ropewiki.com/Page_2',
            latestRevisionDate,
            { lat: 37.7749, lon: -122.4194 },
            undefined,
            '5.9',
        );

        const page3 = new RopewikiPage(
            '9999',
            'Page 3',
            testRegionId,
            'https://ropewiki.com/Page_3',
            latestRevisionDate,
            { lat: 35.0, lon: -120.0 },
            undefined,
            '5.8',
        );

        // Insert pages
        const inserted1 = await db.insert('RopewikiPage', page1.toDbRow()).run(conn);
        const inserted2 = await db.insert('RopewikiPage', page2.toDbRow()).run(conn);
        const inserted3 = await db.insert('RopewikiPage', page3.toDbRow()).run(conn);

        const page1Id = inserted1.id;
        const page2Id = inserted2.id;
        const page3Id = inserted3.id;

        // Create existing route for page1
        const existingRouteId = '11111111-1111-1111-1111-111111111111';
        await db
            .insert('Route', {
                id: existingRouteId,
                name: 'Existing Route',
                type: 'Canyon',
                coordinates: { lat: 40.123, lon: -111.456 },
            })
            .run(conn);

        const existingRoute = new Route(
            existingRouteId,
            'Existing Route',
            RouteType.Canyon,
            { lat: 40.123, lon: -111.456 },
        );

        // Fetch pages from database
        const dbPages1 = await db.select('RopewikiPage', { id: page1Id }).run(conn);
        const dbPages2 = await db.select('RopewikiPage', { id: page2Id }).run(conn);
        const dbPages3 = await db.select('RopewikiPage', { id: page3Id }).run(conn);
        const pages = [
            RopewikiPage.fromDbRow(dbPages1[0]!),
            RopewikiPage.fromDbRow(dbPages2[0]!),
            RopewikiPage.fromDbRow(dbPages3[0]!),
        ];

        // Call insertMissingRoutes with mixed routes
        const routesAndPages: Array<[Route | null, RopewikiPage]> = [
            [existingRoute, pages[0]!],
            [null, pages[1]!],
            [null, pages[2]!],
        ];

        const result = await insertMissingRoutes(conn, routesAndPages);

        expect(result).toHaveLength(3);
        
        // First page should have existing route
        const [route1, resultPage1] = result[0]!;
        expect(resultPage1.id).toBe(page1Id);
        expect(route1).toBe(existingRoute);
        expect(route1.id).toBe(existingRouteId);

        // Second page should have newly inserted route
        const [route2, resultPage2] = result[1]!;
        expect(resultPage2.id).toBe(page2Id);
        expect(route2).not.toBeNull();
        expect(route2.id).toBeDefined();
        expect(route2.name).toBe('Page 2');
        expect(route2.type).toBe(RouteType.Canyon);

        // Third page should have newly inserted route
        const [route3, resultPage3] = result[2]!;
        expect(resultPage3.id).toBe(page3Id);
        expect(route3).not.toBeNull();
        expect(route3.id).toBeDefined();
        expect(route3.name).toBe('Page 3');
        expect(route3.type).toBe(RouteType.Canyon);
    });

    it('returns empty array when input is empty', async () => {
        const result = await insertMissingRoutes(conn, []);

        expect(result).toHaveLength(0);
    });

    it('correctly determines RouteType from page rating', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create pages with different ratings
        const canyonPage = new RopewikiPage(
            '728',
            'Canyon Page',
            testRegionId,
            'https://ropewiki.com/Canyon_Page',
            latestRevisionDate,
            { lat: 40.123, lon: -111.456 },
            undefined,
            '5.10a',
        );

        const cavePage = new RopewikiPage(
            '5597',
            'Cave Page',
            testRegionId,
            'https://ropewiki.com/Cave_Page',
            latestRevisionDate,
            { lat: 37.7749, lon: -122.4194 },
            undefined,
            '5.9 Cave',
        );

        const poiPage = new RopewikiPage(
            '9999',
            'POI Page',
            testRegionId,
            'https://ropewiki.com/POI_Page',
            latestRevisionDate,
            { lat: 35.0, lon: -120.0 },
            undefined,
            '5.8 POI',
        );

        const unknownPage = new RopewikiPage(
            '8888',
            'Unknown Page',
            testRegionId,
            'https://ropewiki.com/Unknown_Page',
            latestRevisionDate,
            { lat: 33.0, lon: -118.0 },
        );

        // Insert pages
        const inserted1 = await db.insert('RopewikiPage', canyonPage.toDbRow()).run(conn);
        const inserted2 = await db.insert('RopewikiPage', cavePage.toDbRow()).run(conn);
        const inserted3 = await db.insert('RopewikiPage', poiPage.toDbRow()).run(conn);
        const inserted4 = await db.insert('RopewikiPage', unknownPage.toDbRow()).run(conn);

        // Fetch pages from database
        const dbPages1 = await db.select('RopewikiPage', { id: inserted1.id }).run(conn);
        const dbPages2 = await db.select('RopewikiPage', { id: inserted2.id }).run(conn);
        const dbPages3 = await db.select('RopewikiPage', { id: inserted3.id }).run(conn);
        const dbPages4 = await db.select('RopewikiPage', { id: inserted4.id }).run(conn);
        const pages = [
            RopewikiPage.fromDbRow(dbPages1[0]!),
            RopewikiPage.fromDbRow(dbPages2[0]!),
            RopewikiPage.fromDbRow(dbPages3[0]!),
            RopewikiPage.fromDbRow(dbPages4[0]!),
        ];

        // Call insertMissingRoutes
        const routesAndPages: Array<[Route | null, RopewikiPage]> = [
            [null, pages[0]!],
            [null, pages[1]!],
            [null, pages[2]!],
            [null, pages[3]!],
        ];

        const result = await insertMissingRoutes(conn, routesAndPages);

        expect(result).toHaveLength(4);
        
        expect(result[0]![0].type).toBe(RouteType.Canyon);
        expect(result[1]![0].type).toBe(RouteType.Cave);
        expect(result[2]![0].type).toBe(RouteType.POI);
        expect(result[3]![0].type).toBe(RouteType.Unknown);
    });

    it('inserts all routes in a single database operation', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create multiple pages
        const pages = Array.from({ length: 5 }, (_, i) => 
            new RopewikiPage(
                `${i + 1}`,
                `Page ${i + 1}`,
                testRegionId,
                `https://ropewiki.com/Page_${i + 1}`,
                latestRevisionDate,
                { lat: 40.0 + i, lon: -111.0 - i },
                undefined,
                '5.10a',
            )
        );

        // Insert pages
        const insertedPages = await Promise.all(
            pages.map(page => db.insert('RopewikiPage', page.toDbRow()).run(conn))
        );

        // Fetch pages from database
        const dbPages = await Promise.all(
            insertedPages.map(inserted => 
                db.select('RopewikiPage', { id: inserted.id }).run(conn)
            )
        );
        const pagesWithIds = dbPages.map((rows, i) => RopewikiPage.fromDbRow(rows[0]!));

        // Count routes before insertion
        const routesBefore = await db.select('Route', {}).run(conn);
        const countBefore = routesBefore.length;

        // Call insertMissingRoutes
        const routesAndPages: Array<[Route | null, RopewikiPage]> = 
            pagesWithIds.map(page => [null, page]);

        const result = await insertMissingRoutes(conn, routesAndPages);

        // Count routes after insertion
        const routesAfter = await db.select('Route', {}).run(conn);
        const countAfter = routesAfter.length;

        expect(result).toHaveLength(5);
        expect(countAfter - countBefore).toBe(5); // All 5 routes should be inserted
    });

    it('preserves order: existing routes first, then newly inserted routes', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create pages
        const page1 = new RopewikiPage(
            '728',
            'Page 1',
            testRegionId,
            'https://ropewiki.com/Page_1',
            latestRevisionDate,
            { lat: 40.123, lon: -111.456 },
            undefined,
            '5.10a',
        );

        const page2 = new RopewikiPage(
            '5597',
            'Page 2',
            testRegionId,
            'https://ropewiki.com/Page_2',
            latestRevisionDate,
            { lat: 37.7749, lon: -122.4194 },
            undefined,
            '5.9',
        );

        const page3 = new RopewikiPage(
            '9999',
            'Page 3',
            testRegionId,
            'https://ropewiki.com/Page_3',
            latestRevisionDate,
            { lat: 35.0, lon: -120.0 },
            undefined,
            '5.8',
        );

        // Insert pages
        const inserted1 = await db.insert('RopewikiPage', page1.toDbRow()).run(conn);
        const inserted2 = await db.insert('RopewikiPage', page2.toDbRow()).run(conn);
        const inserted3 = await db.insert('RopewikiPage', page3.toDbRow()).run(conn);

        // Create existing route for page1
        const existingRouteId = '11111111-1111-1111-1111-111111111111';
        await db
            .insert('Route', {
                id: existingRouteId,
                name: 'Existing Route',
                type: 'Canyon',
                coordinates: { lat: 40.123, lon: -111.456 },
            })
            .run(conn);

        const existingRoute = new Route(
            existingRouteId,
            'Existing Route',
            RouteType.Canyon,
            { lat: 40.123, lon: -111.456 },
        );

        // Fetch pages from database
        const dbPages1 = await db.select('RopewikiPage', { id: inserted1.id }).run(conn);
        const dbPages2 = await db.select('RopewikiPage', { id: inserted2.id }).run(conn);
        const dbPages3 = await db.select('RopewikiPage', { id: inserted3.id }).run(conn);
        const pages = [
            RopewikiPage.fromDbRow(dbPages1[0]!),
            RopewikiPage.fromDbRow(dbPages2[0]!),
            RopewikiPage.fromDbRow(dbPages3[0]!),
        ];

        // Call insertMissingRoutes with existing route first, then nulls
        const routesAndPages: Array<[Route | null, RopewikiPage]> = [
            [existingRoute, pages[0]!],
            [null, pages[1]!],
            [null, pages[2]!],
        ];

        const result = await insertMissingRoutes(conn, routesAndPages);

        expect(result).toHaveLength(3);
        
        // First result should be the existing route
        expect(result[0]![0]).toBe(existingRoute);
        expect(result[0]![1].id).toBe(inserted1.id);
        
        // Second and third should be newly inserted routes
        expect(result[1]![0].id).toBeDefined();
        expect(result[1]![1].id).toBe(inserted2.id);
        expect(result[2]![0].id).toBeDefined();
        expect(result[2]![1].id).toBe(inserted3.id);
    });
});
