import { Pool } from 'pg';
import * as db from 'zapatos/db';
import { describe, it, expect, afterEach, beforeAll, afterAll } from '@jest/globals';
import getPagesWithRoutes from '../../../src/ropewiki/database/getPagesWithRoutes';
import RopewikiPage from '../../../src/ropewiki/types/page';

describe('getPagesWithRoutes (integration)', () => {
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

    it('returns page UUIDs that have routes', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create pages
        const page1 = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['728'],
                name: ['Page With Route'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Page_With_Route'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        const page2 = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['5597'],
                name: ['Another Page With Route'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Another_Page_With_Route'],
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
                    type: 'trail',
                    coordinates: { lat: 40.123, lon: -111.456 },
                },
                {
                    id: route2Id,
                    name: 'Route 2',
                    type: 'trail',
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
                    vectorTile: null,
                },
                {
                    route: route2Id,
                    ropewikiPage: page2Id,
                    vectorTile: null,
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

        // Query for pages with routes
        const results = await getPagesWithRoutes(conn, pages);

        expect(results).toHaveLength(2);
        const resultIds = results.map(r => r.id);
        expect(resultIds).toContain(page1Id);
        expect(resultIds).toContain(page2Id);
    });

    it('filters out pages without routes', async () => {
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
                type: 'trail',
                coordinates: { lat: 40.123, lon: -111.456 },
            })
            .run(conn);

        // Create RopewikiRoute entry only for pageWithRoute
        await db
            .insert('RopewikiRoute', {
                route: routeId,
                ropewikiPage: pageWithRouteId,
                vectorTile: null,
            })
            .run(conn);

        // Fetch pages from database to get RopewikiPage objects with IDs
        const dbPagesWithRoute = await db.select('RopewikiPage', { id: pageWithRouteId }).run(conn);
        const dbPagesWithoutRoute = await db.select('RopewikiPage', { id: pageWithoutRouteId }).run(conn);
        const pages = [
            RopewikiPage.fromDbRow(dbPagesWithRoute[0]!),
            RopewikiPage.fromDbRow(dbPagesWithoutRoute[0]!),
        ];

        // Query for pages with routes
        const results = await getPagesWithRoutes(conn, pages);

        expect(results).toHaveLength(1);
        const resultIds = results.map(r => r.id);
        expect(resultIds).toContain(pageWithRouteId);
        expect(resultIds).not.toContain(pageWithoutRouteId);
    });

    it('returns empty array when no pages provided', async () => {
        const results = await getPagesWithRoutes(conn, []);

        expect(results).toHaveLength(0);
    });

    it('returns empty array when pages have no IDs', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create pages without IDs (from constructor)
        const page1 = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['728'],
                name: ['Page Without ID'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Page_Without_ID'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        const results = await getPagesWithRoutes(conn, [page1]);

        expect(results).toHaveLength(0);
    });

    it('returns empty array when all pages have no routes', async () => {
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

        // Query for pages with routes
        const results = await getPagesWithRoutes(conn, pages);

        expect(results).toHaveLength(0);
    });

    it('filters out pages with deleted routes', async () => {
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
                type: 'trail',
                coordinates: { lat: 40.123, lon: -111.456 },
            })
            .run(conn);

        // Create RopewikiRoute entry and then mark it as deleted
        const ropewikiRouteId = await db
            .insert('RopewikiRoute', {
                route: routeId,
                ropewikiPage: pageId,
                vectorTile: null,
            })
            .run(conn);

        const now = new Date();
        await db
            .update('RopewikiRoute', { deletedAt: now }, { route: routeId, ropewikiPage: pageId })
            .run(conn);

        // Fetch page from database to get RopewikiPage object with ID
        const dbPages = await db.select('RopewikiPage', { id: pageId }).run(conn);
        const pages = [RopewikiPage.fromDbRow(dbPages[0]!)];

        // Query for pages with routes
        const results = await getPagesWithRoutes(conn, pages);

        expect(results).toHaveLength(0);
    });

    it('filters out deleted pages', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create page
        const page = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['728'],
                name: ['Deleted Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Deleted_Page'],
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
                type: 'trail',
                coordinates: { lat: 40.123, lon: -111.456 },
            })
            .run(conn);

        // Create RopewikiRoute entry
        await db
            .insert('RopewikiRoute', {
                route: routeId,
                ropewikiPage: pageId,
                vectorTile: null,
            })
            .run(conn);

        // Mark page as deleted
        const now = new Date();
        await db
            .update('RopewikiPage', { deletedAt: now }, { id: pageId })
            .run(conn);

        // Fetch page from database to get RopewikiPage object with ID
        const dbPages = await db.select('RopewikiPage', { id: pageId }).run(conn);
        const pages = [RopewikiPage.fromDbRow(dbPages[0]!)];

        // Query for pages with routes
        const results = await getPagesWithRoutes(conn, pages);

        expect(results).toHaveLength(0);
    });

});
