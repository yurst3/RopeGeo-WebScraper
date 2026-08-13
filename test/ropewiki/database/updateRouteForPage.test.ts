import { Pool } from 'pg';
import * as db from 'zapatos/db';
import { describe, it, expect, afterEach, beforeAll, afterAll } from '@jest/globals';
import updateRouteForPage from '../../../src/ropewiki/database/updateRouteForPage';
import RopewikiPage from '../../../src/ropewiki/types/page';

describe('updateRouteForPage (integration)', () => {
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
        await db.sql`DELETE FROM "RopewikiRoute"`.run(conn);
        await db.sql`DELETE FROM "Route"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);

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

    const insertPage = async (opts: {
        externalPageId: string;
        name: string;
        coordinates: { lat: number; lon: number };
        quality?: number;
        userVotes?: number;
    }): Promise<string> => {
        const page = new RopewikiPage(
            opts.externalPageId,
            opts.name,
            testRegionId,
            `https://ropewiki.com/${opts.name.replace(/\s+/g, '_')}`,
            new Date('2025-01-02T12:34:56Z'),
            opts.coordinates,
            opts.quality,
        );
        page.userVotes = opts.userVotes;
        const inserted = await db.insert('RopewikiPage', page.toDbRow()).run(conn);
        return inserted.id;
    };

    it('updates route name and coordinates from the linked page when it is the only page', async () => {
        const pageId = await insertPage({
            externalPageId: '728',
            name: 'Updated Page Name',
            coordinates: { lat: 40.789, lon: -111.123 },
            quality: 3,
            userVotes: 2,
        });

        const routeId = '11111111-1111-1111-1111-111111111111';
        await db
            .insert('Route', {
                id: routeId,
                name: 'Initial Route Name',
                type: 'Canyon',
                coordinates: { lat: 37.7749, lon: -122.4194 },
            })
            .run(conn);

        await db
            .insert('RopewikiRoute', {
                route: routeId,
                ropewikiPage: pageId,
                mapData: null,
            })
            .run(conn);

        const dbPages = await db.select('RopewikiPage', { id: pageId }).run(conn);
        const pageWithId = RopewikiPage.fromDbRow(dbPages[0]!);

        await new Promise(resolve => setTimeout(resolve, 10));
        await updateRouteForPage(conn, pageWithId);

        const updatedRoute = await db.selectOne('Route', { id: routeId }).run(conn);

        expect(updatedRoute).toBeDefined();
        expect(updatedRoute!.name).toBe('Updated Page Name');
        expect(updatedRoute!.coordinates).toEqual({ lat: 40.789, lon: -111.123 });
        expect(new Date(updatedRoute!.updatedAt).getTime()).toBeGreaterThan(new Date('2025-01-02T12:34:56Z').getTime());
    });

    it('names the route after the most popular linked page, not the updated page', async () => {
        const popularPageId = await insertPage({
            externalPageId: '100',
            name: 'Popular Canyon',
            coordinates: { lat: 40.0, lon: -111.0 },
            quality: 5,
            userVotes: 20,
        });
        const updatedPageId = await insertPage({
            externalPageId: '200',
            name: 'Obscure Variant',
            coordinates: { lat: 40.0, lon: -111.0 },
            quality: 2,
            userVotes: 1,
        });

        const routeId = '22222222-2222-2222-2222-222222222222';
        await db
            .insert('Route', {
                id: routeId,
                name: 'Stale Name',
                type: 'Canyon',
                coordinates: { lat: 39.0, lon: -110.0 },
            })
            .run(conn);

        await db
            .insert('RopewikiRoute', [
                { route: routeId, ropewikiPage: popularPageId, mapData: null },
                { route: routeId, ropewikiPage: updatedPageId, mapData: null },
            ])
            .run(conn);

        const dbPages = await db.select('RopewikiPage', { id: updatedPageId }).run(conn);
        await updateRouteForPage(conn, RopewikiPage.fromDbRow(dbPages[0]!));

        const updatedRoute = await db.selectOne('Route', { id: routeId }).run(conn);
        expect(updatedRoute!.name).toBe('Popular Canyon');
        expect(updatedRoute!.coordinates).toEqual({ lat: 40.0, lon: -111.0 });
    });

    it('on equal popularity, picks the linked page with the lower id', async () => {
        const pageAId = await insertPage({
            externalPageId: 'aaa',
            name: 'Alpha',
            coordinates: { lat: 41.0, lon: -112.0 },
            quality: 3,
            userVotes: 3,
        });
        const pageBId = await insertPage({
            externalPageId: 'bbb',
            name: 'Beta',
            coordinates: { lat: 41.0, lon: -112.0 },
            quality: 3,
            userVotes: 3,
        });

        // Ensure deterministic tie-break by id order
        const [firstId, secondId] = pageAId < pageBId ? [pageAId, pageBId] : [pageBId, pageAId];
        const firstName = firstId === pageAId ? 'Alpha' : 'Beta';

        const routeId = '33333333-3333-3333-3333-333333333333';
        await db
            .insert('Route', {
                id: routeId,
                name: 'Stale',
                type: 'Canyon',
                coordinates: { lat: 41.0, lon: -112.0 },
            })
            .run(conn);

        await db
            .insert('RopewikiRoute', [
                { route: routeId, ropewikiPage: firstId, mapData: null },
                { route: routeId, ropewikiPage: secondId, mapData: null },
            ])
            .run(conn);

        const dbPages = await db.select('RopewikiPage', { id: secondId }).run(conn);
        await updateRouteForPage(conn, RopewikiPage.fromDbRow(dbPages[0]!));

        const updatedRoute = await db.selectOne('Route', { id: routeId }).run(conn);
        expect(updatedRoute!.name).toBe(firstName);
    });

    it('throws error when page has no id', async () => {
        const page = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['728'],
                name: ['Test Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Test_Page'],
                coordinates: [{ lat: 40.123, lon: -111.456 }],
                latestRevisionDate: [{ timestamp: String(Math.floor(Date.now() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        await expect(updateRouteForPage(conn, page)).rejects.toThrow('Page must have an id to update route');
    });

    it('does not update route when page has no linked route', async () => {
        const pageId = await insertPage({
            externalPageId: '728',
            name: 'Test Page',
            coordinates: { lat: 40.123, lon: -111.456 },
        });

        const routeId = '11111111-1111-1111-1111-111111111111';
        const initialRouteName = 'Initial Route Name';
        const initialCoordinates = { lat: 37.7749, lon: -122.4194 };

        await db
            .insert('Route', {
                id: routeId,
                name: initialRouteName,
                type: 'Canyon',
                coordinates: initialCoordinates,
            })
            .run(conn);

        const dbPages = await db.select('RopewikiPage', { id: pageId }).run(conn);
        await updateRouteForPage(conn, RopewikiPage.fromDbRow(dbPages[0]!));

        const route = await db.selectOne('Route', { id: routeId }).run(conn);
        expect(route!.name).toBe(initialRouteName);
        expect(route!.coordinates).toEqual(initialCoordinates);
    });

    it('does not update route when RopewikiRoute is deleted', async () => {
        const pageId = await insertPage({
            externalPageId: '728',
            name: 'Test Page',
            coordinates: { lat: 40.123, lon: -111.456 },
        });

        const routeId = '11111111-1111-1111-1111-111111111111';
        const initialRouteName = 'Initial Route Name';
        const initialCoordinates = { lat: 37.7749, lon: -122.4194 };

        await db
            .insert('Route', {
                id: routeId,
                name: initialRouteName,
                type: 'Canyon',
                coordinates: initialCoordinates,
            })
            .run(conn);

        await db
            .insert('RopewikiRoute', {
                route: routeId,
                ropewikiPage: pageId,
                mapData: null,
            })
            .run(conn);

        await db
            .update('RopewikiRoute', { deletedAt: new Date() }, { route: routeId, ropewikiPage: pageId })
            .run(conn);

        const dbPages = await db.select('RopewikiPage', { id: pageId }).run(conn);
        const pageWithId = RopewikiPage.fromDbRow(dbPages[0]!);
        pageWithId.name = 'Updated Page Name';

        await updateRouteForPage(conn, pageWithId);

        const route = await db.selectOne('Route', { id: routeId }).run(conn);
        expect(route!.name).toBe(initialRouteName);
        expect(route!.coordinates).toEqual(initialCoordinates);
    });
});
