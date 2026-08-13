import { Pool } from 'pg';
import * as db from 'zapatos/db';
import { describe, it, expect, afterEach, beforeAll, afterAll } from '@jest/globals';
import findRoutesByCoordinates from '../../../src/ropewiki/database/findRoutesByCoordinates';
import correlateExistingRoutes from '../../../src/ropewiki/util/correlateExistingRoutes';
import RopewikiPage from '../../../src/ropewiki/types/page';
import { Route, RouteType } from 'ropegeo-common/models';
import { coordinatesKey } from '../../../src/ropewiki/util/pagePopularity';

describe('findRoutesByCoordinates / correlateExistingRoutes (integration)', () => {
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

    it('findRoutesByCoordinates returns matching routes keyed by coordinates', async () => {
        await db
            .insert('Route', {
                id: '11111111-1111-1111-1111-111111111111',
                name: 'Match',
                type: 'Canyon',
                coordinates: { lat: 40.1, lon: -111.5 },
            })
            .run(conn);
        await db
            .insert('Route', {
                id: '22222222-2222-2222-2222-222222222222',
                name: 'Other',
                type: 'Canyon',
                coordinates: { lat: 35.0, lon: -120.0 },
            })
            .run(conn);

        const found = await findRoutesByCoordinates(conn, [{ lat: 40.1, lon: -111.5 }]);

        expect(found.size).toBe(1);
        expect(found.get(coordinatesKey({ lat: 40.1, lon: -111.5 }))?.id)
            .toBe('11111111-1111-1111-1111-111111111111');
    });

    it('findRoutesByCoordinates prefers the oldest route when duplicates share coordinates', async () => {
        await db
            .insert('Route', {
                id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                name: 'Older',
                type: 'Canyon',
                coordinates: { lat: 40.1, lon: -111.5 },
                createdAt: new Date('2024-01-01T00:00:00Z'),
            })
            .run(conn);
        await db
            .insert('Route', {
                id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
                name: 'Newer',
                type: 'Canyon',
                coordinates: { lat: 40.1, lon: -111.5 },
                createdAt: new Date('2025-01-01T00:00:00Z'),
            })
            .run(conn);

        const found = await findRoutesByCoordinates(conn, [{ lat: 40.1, lon: -111.5 }]);
        expect(found.get(coordinatesKey({ lat: 40.1, lon: -111.5 }))?.id)
            .toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    });

    it('correlateExistingRoutes assigns routes by matching coordinates', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        const page = new RopewikiPage(
            '728',
            'New Page',
            testRegionId,
            'https://ropewiki.com/New_Page',
            latestRevisionDate,
            { lat: 40.1, lon: -111.5 },
            undefined,
            '5.10a',
        );
        const inserted = await db.insert('RopewikiPage', page.toDbRow()).run(conn);
        const dbPages = await db.select('RopewikiPage', { id: inserted.id }).run(conn);
        const pageWithId = RopewikiPage.fromDbRow(dbPages[0]!);

        await db
            .insert('Route', {
                id: '11111111-1111-1111-1111-111111111111',
                name: 'Existing',
                type: 'Canyon',
                coordinates: { lat: 40.1, lon: -111.5 },
            })
            .run(conn);

        const result = await correlateExistingRoutes(conn, [[null, pageWithId]]);

        expect(result).toHaveLength(1);
        expect(result[0]![0]?.id).toBe('11111111-1111-1111-1111-111111111111');
        expect(result[0]![1].id).toBe(inserted.id);
    });

    it('correlateExistingRoutes leaves pages that already have a route unchanged', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        const page = new RopewikiPage(
            '728',
            'Linked Page',
            testRegionId,
            'https://ropewiki.com/Linked_Page',
            latestRevisionDate,
            { lat: 40.1, lon: -111.5 },
            undefined,
            '5.10a',
        );
        const inserted = await db.insert('RopewikiPage', page.toDbRow()).run(conn);
        const dbPages = await db.select('RopewikiPage', { id: inserted.id }).run(conn);
        const pageWithId = RopewikiPage.fromDbRow(dbPages[0]!);

        const existingRoute = new Route(
            'cccccccc-cccc-cccc-cccc-cccccccccccc',
            'Already Linked',
            RouteType.Canyon,
            { lat: 40.1, lon: -111.5 },
        );

        await db
            .insert('Route', {
                id: '11111111-1111-1111-1111-111111111111',
                name: 'Other Match',
                type: 'Canyon',
                coordinates: { lat: 40.1, lon: -111.5 },
            })
            .run(conn);

        const result = await correlateExistingRoutes(conn, [[existingRoute, pageWithId]]);

        expect(result[0]![0]).toBe(existingRoute);
    });

    it('findRoutesByCoordinates returns an empty map for an empty coordinate list', async () => {
        const found = await findRoutesByCoordinates(conn, []);
        expect(found.size).toBe(0);
    });

    it('findRoutesByCoordinates ignores deleted routes', async () => {
        await db
            .insert('Route', {
                id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
                name: 'Deleted',
                type: 'Canyon',
                coordinates: { lat: 40.1, lon: -111.5 },
                deletedAt: new Date('2025-01-01T00:00:00Z'),
            })
            .run(conn);

        const found = await findRoutesByCoordinates(conn, [{ lat: 40.1, lon: -111.5 }]);
        expect(found.size).toBe(0);
    });

    it('correlateExistingRoutes leaves pages unchanged when no coordinate match exists', async () => {
        const page = new RopewikiPage(
            '999',
            'Unmatched Page',
            testRegionId,
            'https://ropewiki.com/Unmatched_Page',
            new Date('2025-01-02T12:34:56Z'),
            { lat: 10.0, lon: 20.0 },
            undefined,
            '5.10a',
        );
        const inserted = await db.insert('RopewikiPage', page.toDbRow()).run(conn);
        const pageWithId = RopewikiPage.fromDbRow(
            (await db.select('RopewikiPage', { id: inserted.id }).run(conn))[0]!,
        );

        const result = await correlateExistingRoutes(conn, [[null, pageWithId]]);
        expect(result[0]![0]).toBeNull();
        expect(result[0]![1].id).toBe(inserted.id);
    });

    it('correlateExistingRoutes keeps null for pages without coordinates while matching siblings', async () => {
        const withCoords = new RopewikiPage(
            '111',
            'With Coords',
            testRegionId,
            'https://ropewiki.com/With_Coords',
            new Date('2025-01-02T12:34:56Z'),
            { lat: 40.1, lon: -111.5 },
            undefined,
            '5.10a',
        );
        const withoutCoords = new RopewikiPage(
            '222',
            'Without Coords',
            testRegionId,
            'https://ropewiki.com/Without_Coords',
            new Date('2025-01-02T12:34:56Z'),
        );

        const insertedWith = await db.insert('RopewikiPage', withCoords.toDbRow()).run(conn);
        const insertedWithout = await db.insert('RopewikiPage', withoutCoords.toDbRow()).run(conn);
        const pageWith = RopewikiPage.fromDbRow(
            (await db.select('RopewikiPage', { id: insertedWith.id }).run(conn))[0]!,
        );
        const pageWithout = RopewikiPage.fromDbRow(
            (await db.select('RopewikiPage', { id: insertedWithout.id }).run(conn))[0]!,
        );

        await db
            .insert('Route', {
                id: '11111111-1111-1111-1111-111111111111',
                name: 'Existing',
                type: 'Canyon',
                coordinates: { lat: 40.1, lon: -111.5 },
            })
            .run(conn);

        const result = await correlateExistingRoutes(conn, [
            [null, pageWith],
            [null, pageWithout],
        ]);

        expect(result[0]![0]?.id).toBe('11111111-1111-1111-1111-111111111111');
        expect(result[1]![0]).toBeNull();
    });

    it('correlateExistingRoutes assigns only pages whose coordinates match', async () => {
        const matchPage = new RopewikiPage(
            '333',
            'Match Page',
            testRegionId,
            'https://ropewiki.com/Match_Page',
            new Date('2025-01-02T12:34:56Z'),
            { lat: 40.1, lon: -111.5 },
            undefined,
            '5.10a',
        );
        const missPage = new RopewikiPage(
            '444',
            'Miss Page',
            testRegionId,
            'https://ropewiki.com/Miss_Page',
            new Date('2025-01-02T12:34:56Z'),
            { lat: 1.0, lon: 2.0 },
            undefined,
            '5.10a',
        );

        const insertedMatch = await db.insert('RopewikiPage', matchPage.toDbRow()).run(conn);
        const insertedMiss = await db.insert('RopewikiPage', missPage.toDbRow()).run(conn);
        const pageMatch = RopewikiPage.fromDbRow(
            (await db.select('RopewikiPage', { id: insertedMatch.id }).run(conn))[0]!,
        );
        const pageMiss = RopewikiPage.fromDbRow(
            (await db.select('RopewikiPage', { id: insertedMiss.id }).run(conn))[0]!,
        );

        await db
            .insert('Route', {
                id: '11111111-1111-1111-1111-111111111111',
                name: 'Existing',
                type: 'Canyon',
                coordinates: { lat: 40.1, lon: -111.5 },
            })
            .run(conn);

        const result = await correlateExistingRoutes(conn, [
            [null, pageMatch],
            [null, pageMiss],
        ]);

        expect(result[0]![0]?.id).toBe('11111111-1111-1111-1111-111111111111');
        expect(result[1]![0]).toBeNull();
    });
});
