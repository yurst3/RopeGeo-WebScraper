import { Pool } from 'pg';
import * as db from 'zapatos/db';
import { describe, it, expect, afterEach, beforeAll, afterAll } from '@jest/globals';
import updatePageRoute from '../../database/updatePageRoute';
import RopewikiPageInfo from '../../types/ropewiki';

describe('updatePageRoute (integration)', () => {
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

    it('updates route name, coordinates, and updatedAt for a page with a route', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create page
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

        // Insert page
        const dbRow = page.toDbRow();
        const inserted = await db.insert('RopewikiPage', dbRow).run(conn);
        const pageId = inserted.id;

        // Create route
        const routeId = '11111111-1111-1111-1111-111111111111';
        const initialRouteName = 'Initial Route Name';
        const initialCoordinates = { lat: 37.7749, lon: -122.4194 };
        
        await db
            .insert('Route', {
                id: routeId,
                name: initialRouteName,
                type: 'trail',
                coordinates: initialCoordinates,
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

        // Fetch page from database to get RopewikiPageInfo object with ID
        const dbPages = await db.select('RopewikiPage', { id: pageId }).run(conn);
        const pageWithId = RopewikiPageInfo.fromDbRow(dbPages[0]!);

        // Update the page name and coordinates
        pageWithId.name = 'Updated Page Name';
        pageWithId.coordinates = { lat: 40.789, lon: -111.123 };

        // Wait a bit to ensure updatedAt changes
        await new Promise(resolve => setTimeout(resolve, 10));

        // Update the route
        await updatePageRoute(conn, pageWithId);

        // Verify the route was updated
        const updatedRoute = await db.selectOne('Route', { id: routeId }).run(conn);

        expect(updatedRoute).toBeDefined();
        expect(updatedRoute!.name).toBe('Updated Page Name');
        expect(updatedRoute!.coordinates).toEqual({ lat: 40.789, lon: -111.123 });
        expect(new Date(updatedRoute!.updatedAt).getTime()).toBeGreaterThan(new Date('2025-01-02T12:34:56Z').getTime());
    });

    it('throws error when page has no id', async () => {
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

        // Attempt to update route - should throw error
        await expect(updatePageRoute(conn, page)).rejects.toThrow('Page must have an id to update route');
    });

    it('throws error when page has no coordinates', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create page
        const page = new RopewikiPageInfo({
            printouts: {
                pageid: ['728'],
                name: ['Test Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Test_Page'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        // Insert page
        const dbRow = page.toDbRow();
        const inserted = await db.insert('RopewikiPage', dbRow).run(conn);
        const pageId = inserted.id;

        // Fetch page from database to get RopewikiPageInfo object with ID
        const dbPages = await db.select('RopewikiPage', { id: pageId }).run(conn);
        const pageWithId = RopewikiPageInfo.fromDbRow(dbPages[0]!);

        // Remove coordinates
        pageWithId.coordinates = undefined;

        // Attempt to update route - should throw error
        await expect(updatePageRoute(conn, pageWithId)).rejects.toThrow('Page must have coordinates to update route');
    });

    it('does not update route when page has no linked route', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create page
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

        // Insert page
        const dbRow = page.toDbRow();
        const inserted = await db.insert('RopewikiPage', dbRow).run(conn);
        const pageId = inserted.id;

        // Create route (not linked to page)
        const routeId = '11111111-1111-1111-1111-111111111111';
        const initialRouteName = 'Initial Route Name';
        const initialCoordinates = { lat: 37.7749, lon: -122.4194 };
        
        await db
            .insert('Route', {
                id: routeId,
                name: initialRouteName,
                type: 'trail',
                coordinates: initialCoordinates,
            })
            .run(conn);

        // Fetch page from database to get RopewikiPageInfo object with ID
        const dbPages = await db.select('RopewikiPage', { id: pageId }).run(conn);
        const pageWithId = RopewikiPageInfo.fromDbRow(dbPages[0]!);

        // Update the page name and coordinates
        pageWithId.name = 'Updated Page Name';
        pageWithId.coordinates = { lat: 40.789, lon: -111.123 };

        // Update the route (should not affect anything since page has no linked route)
        await updatePageRoute(conn, pageWithId);

        // Verify the route was not updated
        const route = await db.selectOne('Route', { id: routeId }).run(conn);

        expect(route).toBeDefined();
        expect(route!.name).toBe(initialRouteName);
        expect(route!.coordinates).toEqual(initialCoordinates);
    });

    it('does not update route when RopewikiRoute is deleted', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create page
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

        // Insert page
        const dbRow = page.toDbRow();
        const inserted = await db.insert('RopewikiPage', dbRow).run(conn);
        const pageId = inserted.id;

        // Create route
        const routeId = '11111111-1111-1111-1111-111111111111';
        const initialRouteName = 'Initial Route Name';
        const initialCoordinates = { lat: 37.7749, lon: -122.4194 };
        
        await db
            .insert('Route', {
                id: routeId,
                name: initialRouteName,
                type: 'trail',
                coordinates: initialCoordinates,
            })
            .run(conn);

        // Create RopewikiRoute entry and mark it as deleted
        await db
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

        // Fetch page from database to get RopewikiPageInfo object with ID
        const dbPages = await db.select('RopewikiPage', { id: pageId }).run(conn);
        const pageWithId = RopewikiPageInfo.fromDbRow(dbPages[0]!);

        // Update the page name and coordinates
        pageWithId.name = 'Updated Page Name';
        pageWithId.coordinates = { lat: 40.789, lon: -111.123 };

        // Update the route (should not affect anything since RopewikiRoute is deleted)
        await updatePageRoute(conn, pageWithId);

        // Verify the route was not updated
        const route = await db.selectOne('Route', { id: routeId }).run(conn);

        expect(route).toBeDefined();
        expect(route!.name).toBe(initialRouteName);
        expect(route!.coordinates).toEqual(initialCoordinates);
    });
});
