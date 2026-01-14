import { Pool } from 'pg';
import * as db from 'zapatos/db';
import { describe, it, expect, afterEach, beforeAll, afterAll } from '@jest/globals';
import insertRoutesForPages from '../../database/insertRoutesForPages';
import RopewikiPageInfo from '../../types/ropewiki';
import { RouteType } from '../../../types/route';

describe('insertRoutesForPages (integration)', () => {
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

    it('returns empty array when pages array is empty', async () => {
        const result = await insertRoutesForPages(conn, []);
        expect(result).toEqual([]);
    });

    it('throws error when pages do not have ids', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create page without ID (from constructor)
        const page = new RopewikiPageInfo({
            printouts: {
                pageid: ['728'],
                name: ['Test Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Test_Page'],
                coordinates: [{ lat: 40.123, lon: -111.456 }],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        // Attempt to insert routes - should throw error
        await expect(insertRoutesForPages(conn, [page])).rejects.toThrow('All pages must have an id');
    });

    it('inserts routes and returns zipped array of route ids and page ids with correct pairings', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create pages
        const page1 = new RopewikiPageInfo({
            printouts: {
                pageid: ['728'],
                name: ['Canyon Route'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Canyon_Route'],
                coordinates: [{ lat: 40.123, lon: -111.456 }],
                rating: ['3C'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        const page2 = new RopewikiPageInfo({
            printouts: {
                pageid: ['5597'],
                name: ['Cave Route'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Cave_Route'],
                coordinates: [{ lat: 41.234, lon: -112.567 }],
                rating: ['3C Cav'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        // Insert pages to get IDs
        const dbRow1 = page1.toDbRow();
        const dbRow2 = page2.toDbRow();
        const inserted1 = await db.insert('RopewikiPage', dbRow1).run(conn);
        const inserted2 = await db.insert('RopewikiPage', dbRow2).run(conn);

        const page1Id = inserted1.id;
        const page2Id = inserted2.id;

        // Fetch pages from database to get RopewikiPageInfo objects with IDs
        const dbPages1 = await db.select('RopewikiPage', { id: page1Id }).run(conn);
        const dbPages2 = await db.select('RopewikiPage', { id: page2Id }).run(conn);
        const pages = [
            RopewikiPageInfo.fromDbRow(dbPages1[0]!),
            RopewikiPageInfo.fromDbRow(dbPages2[0]!),
        ];

        // Insert routes
        const result = await insertRoutesForPages(conn, pages);

        // Verify result is a zipped array
        expect(result).toHaveLength(2);
        expect(Array.isArray(result[0])).toBe(true);
        expect(Array.isArray(result[1])).toBe(true);
        expect(result[0]).toHaveLength(2); // [routeId, pageId]
        expect(result[1]).toHaveLength(2); // [routeId, pageId]

        // Verify pairings are correct
        const [route1Id, page1IdFromResult] = result[0]!;
        const [route2Id, page2IdFromResult] = result[1]!;

        expect(page1IdFromResult).toBe(page1Id);
        expect(page2IdFromResult).toBe(page2Id);

        // Verify routes were inserted correctly
        const route1 = await db.selectOne('Route', { id: route1Id! }).run(conn);
        const route2 = await db.selectOne('Route', { id: route2Id! }).run(conn);

        expect(route1).toBeDefined();
        expect(route1!.name).toBe('Canyon Route');
        expect(route1!.coordinates).toEqual({ lat: 40.123, lon: -111.456 });
        expect(route1!.type).toBe(RouteType.Canyon);

        expect(route2).toBeDefined();
        expect(route2!.name).toBe('Cave Route');
        expect(route2!.coordinates).toEqual({ lat: 41.234, lon: -112.567 });
        expect(route2!.type).toBe(RouteType.Cave);

        // Verify route IDs are valid UUIDs
        expect(route1Id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        expect(route2Id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('correctly determines route types based on page ratings', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create pages with different ratings
        const canyonPage = new RopewikiPageInfo({
            printouts: {
                pageid: ['1'],
                name: ['Canyon Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Canyon_Page'],
                coordinates: [{ lat: 40.123, lon: -111.456 }],
                rating: ['3C'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        const cavePage = new RopewikiPageInfo({
            printouts: {
                pageid: ['2'],
                name: ['Cave Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Cave_Page'],
                coordinates: [{ lat: 41.234, lon: -112.567 }],
                rating: ['3C Cav'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        const poiPage = new RopewikiPageInfo({
            printouts: {
                pageid: ['3'],
                name: ['POI Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/POI_Page'],
                coordinates: [{ lat: 42.345, lon: -113.678 }],
                rating: ['POI'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        const unknownPage = new RopewikiPageInfo({
            printouts: {
                pageid: ['4'],
                name: ['Unknown Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Unknown_Page'],
                coordinates: [{ lat: 43.456, lon: -114.789 }],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        // Insert pages to get IDs
        const insertedCanyon = await db.insert('RopewikiPage', canyonPage.toDbRow()).run(conn);
        const insertedCave = await db.insert('RopewikiPage', cavePage.toDbRow()).run(conn);
        const insertedPOI = await db.insert('RopewikiPage', poiPage.toDbRow()).run(conn);
        const insertedUnknown = await db.insert('RopewikiPage', unknownPage.toDbRow()).run(conn);

        // Fetch pages from database to get RopewikiPageInfo objects with IDs
        const dbCanyon = await db.select('RopewikiPage', { id: insertedCanyon.id }).run(conn);
        const dbCave = await db.select('RopewikiPage', { id: insertedCave.id }).run(conn);
        const dbPOI = await db.select('RopewikiPage', { id: insertedPOI.id }).run(conn);
        const dbUnknown = await db.select('RopewikiPage', { id: insertedUnknown.id }).run(conn);
        const pages = [
            RopewikiPageInfo.fromDbRow(dbCanyon[0]!),
            RopewikiPageInfo.fromDbRow(dbCave[0]!),
            RopewikiPageInfo.fromDbRow(dbPOI[0]!),
            RopewikiPageInfo.fromDbRow(dbUnknown[0]!),
        ];

        // Insert routes
        const result = await insertRoutesForPages(conn, pages);

        // Verify result has correct length
        expect(result).toHaveLength(4);

        // Verify routes were inserted with correct types
        const routeIds = result.map(pair => pair[0]!);
        const routes = await Promise.all(
            routeIds.map(id => db.selectOne('Route', { id }).run(conn))
        );

        expect(routes[0]!.type).toBe(RouteType.Canyon);
        expect(routes[1]!.type).toBe(RouteType.Cave);
        expect(routes[2]!.type).toBe(RouteType.POI);
        expect(routes[3]!.type).toBe(RouteType.Unknown);

        // Verify pairings are correct
        expect(result[0]![1]).toBe(insertedCanyon.id);
        expect(result[1]![1]).toBe(insertedCave.id);
        expect(result[2]![1]).toBe(insertedPOI.id);
        expect(result[3]![1]).toBe(insertedUnknown.id);
    });

    it('handles multiple pages and maintains correct order in zipped array', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create multiple pages
        const pages = [];
        const insertedPageIds = [];

        for (let i = 0; i < 5; i++) {
            const page = new RopewikiPageInfo({
                printouts: {
                    pageid: [String(100 + i)],
                    name: [`Page ${i}`],
                    region: [{ fulltext: 'Test Region' }],
                    url: [`https://ropewiki.com/Page_${i}`],
                    coordinates: [{ lat: 40 + i, lon: -111 - i }],
                    latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
                },
            }, regionNameIds);

            const inserted = await db.insert('RopewikiPage', page.toDbRow()).run(conn);
            insertedPageIds.push(inserted.id);

            const dbPage = await db.select('RopewikiPage', { id: inserted.id }).run(conn);
            pages.push(RopewikiPageInfo.fromDbRow(dbPage[0]!));
        }

        // Insert routes
        const result = await insertRoutesForPages(conn, pages);

        // Verify result has correct length
        expect(result).toHaveLength(5);

        // Verify each pair has correct structure and pairings
        for (let i = 0; i < 5; i++) {
            const [routeId, pageId] = result[i]!;
            
            expect(routeId).toBeDefined();
            expect(pageId).toBe(insertedPageIds[i]);

            // Verify route exists and has correct name
            const route = await db.selectOne('Route', { id: routeId! }).run(conn);
            expect(route).toBeDefined();
            expect(route!.name).toBe(`Page ${i}`);
        }
    });
});
