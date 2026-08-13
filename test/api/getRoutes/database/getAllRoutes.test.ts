import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import { PageDataSource, RouteType } from 'ropegeo-common/models';
import {
    countAllRoutes,
    getAllRoutesPage,
} from '../../../../src/api/getRoutes/database/getAllRoutes';

describe('getAllRoutes (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiRoute"`.run(conn);
        await db.sql`DELETE FROM "Route"`.run(conn);
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "RopewikiRoute"`.run(conn);
        await db.sql`DELETE FROM "Route"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE name LIKE 'GetAllRoutes%'`.run(conn);
    });

    afterAll(async () => {
        await pool.end();
    });

    it('returns only routes where deletedAt is null', async () => {
        await db
            .insert('Route', [
                {
                    name: 'Active Route',
                    type: 'Canyon',
                    coordinates: { lat: 40.1, lon: -111.5 },
                },
                {
                    name: 'Deleted Route',
                    type: 'Cave',
                    coordinates: { lat: 40.2, lon: -111.6 },
                    deletedAt: new Date('2025-01-01T00:00:00Z'),
                },
            ])
            .run(conn);

        const total = await countAllRoutes(conn);
        const result = await getAllRoutesPage(conn, null, 100, 0);

        expect(total).toBe(1);
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('Active Route');
        expect(result[0].type).toBe('Canyon');
        expect(result[0].id).toBeDefined();
        expect(result[0].coordinates).toEqual({ lat: 40.1, lon: -111.5 });
    });

    it('returns all non-deleted routes with correct shape', async () => {
        await db
            .insert('Route', [
                { name: 'Route A', type: 'Canyon', coordinates: { lat: 40.0, lon: -111.0 } },
                { name: 'Route B', type: 'Cave', coordinates: { lat: 41.0, lon: -112.0 } },
            ])
            .run(conn);

        const total = await countAllRoutes(conn);
        const result = await getAllRoutesPage(conn, null, 100, 0);

        expect(total).toBe(2);
        expect(result.length).toBe(2);
        const names = result.map((r) => r.name).sort();
        expect(names).toEqual(['Route A', 'Route B']);
        result.forEach((route) => {
            expect(route).toHaveProperty('id');
            expect(route).toHaveProperty('name');
            expect(route).toHaveProperty('type');
            expect(route).toHaveProperty('coordinates');
        });
    });

    it('returns empty page when no routes exist', async () => {
        const total = await countAllRoutes(conn);
        const result = await getAllRoutesPage(conn, null, 100, 0);
        expect(total).toBe(0);
        expect(result).toEqual([]);
    });

    it('appends (+n) to the name when multiple Ropewiki pages are linked', async () => {
        const regionId = 'a1000001-0001-4000-8000-000000000001';
        const page1Id = 'a2000002-0002-4000-8000-000000000002';
        const page2Id = 'a2000002-0002-4000-8000-000000000003';
        const page3Id = 'a2000002-0002-4000-8000-000000000004';
        const routeId = 'a3000003-0003-4000-8000-000000000003';
        const soloRouteId = 'a3000003-0003-4000-8000-000000000004';
        const soloPageId = 'a2000002-0002-4000-8000-000000000005';

        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegionName: null,
                name: 'GetAllRoutesMultiPageRegion',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/GetAllRoutesMultiPageRegion',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', [
                {
                    id: page1Id,
                    externalPageId: 'multipage-1',
                    name: 'Page One',
                    region: regionId,
                    url: 'https://ropewiki.com/Page_One',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                },
                {
                    id: page2Id,
                    externalPageId: 'multipage-2',
                    name: 'Page Two',
                    region: regionId,
                    url: 'https://ropewiki.com/Page_Two',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                },
                {
                    id: page3Id,
                    externalPageId: 'multipage-3',
                    name: 'Page Three',
                    region: regionId,
                    url: 'https://ropewiki.com/Page_Three',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                },
                {
                    id: soloPageId,
                    externalPageId: 'solo-page',
                    name: 'Solo Page',
                    region: regionId,
                    url: 'https://ropewiki.com/Solo_Page',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                },
            ])
            .run(conn);
        await db
            .insert('Route', [
                {
                    id: routeId,
                    name: 'Shared Canyon',
                    type: 'Canyon',
                    coordinates: { lat: 40.0, lon: -111.0 },
                },
                {
                    id: soloRouteId,
                    name: 'Solo Canyon',
                    type: 'Canyon',
                    coordinates: { lat: 41.0, lon: -112.0 },
                },
            ])
            .run(conn);
        await db
            .insert('RopewikiRoute', [
                { route: routeId, ropewikiPage: page1Id },
                { route: routeId, ropewikiPage: page2Id },
                { route: routeId, ropewikiPage: page3Id },
                { route: soloRouteId, ropewikiPage: soloPageId },
            ])
            .run(conn);

        try {
            const result = await getAllRoutesPage(conn, null, 100, 0);
            const byId = new Map(result.map((r) => [r.id, r]));
            expect(byId.get(routeId)?.name).toBe('Shared Canyon (+2)');
            expect(byId.get(soloRouteId)?.name).toBe('Solo Canyon');
        } finally {
            await db.sql`DELETE FROM "RopewikiRoute"`.run(conn);
            await db.sql`DELETE FROM "Route"`.run(conn);
            await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
            await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);
        }
    });

    it('appends (+n) when listing routes through the filtered query path', async () => {
        const regionId = 'a1000001-0001-4000-8000-000000000010';
        const page1Id = 'a2000002-0002-4000-8000-000000000011';
        const page2Id = 'a2000002-0002-4000-8000-000000000012';
        const routeId = 'a3000003-0003-4000-8000-000000000013';

        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegionName: null,
                name: 'GetAllRoutesFilteredMultiPageRegion',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/GetAllRoutesFilteredMultiPageRegion',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', [
                {
                    id: page1Id,
                    externalPageId: 'filtered-multipage-1',
                    name: 'Filtered Page One',
                    region: regionId,
                    url: 'https://ropewiki.com/Filtered_Page_One',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                },
                {
                    id: page2Id,
                    externalPageId: 'filtered-multipage-2',
                    name: 'Filtered Page Two',
                    region: regionId,
                    url: 'https://ropewiki.com/Filtered_Page_Two',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                },
            ])
            .run(conn);
        await db
            .insert('Route', {
                id: routeId,
                name: 'Filtered Shared',
                type: 'Canyon',
                coordinates: { lat: 42.0, lon: -113.0 },
            })
            .run(conn);
        await db
            .insert('RopewikiRoute', [
                { route: routeId, ropewikiPage: page1Id },
                { route: routeId, ropewikiPage: page2Id },
            ])
            .run(conn);

        const filters = {
            routeTypes: [RouteType.Canyon],
            difficulty: null,
            sources: [PageDataSource.Ropewiki],
        };
        const total = await countAllRoutes(conn, filters);
        const result = await getAllRoutesPage(conn, filters, 100, 0);

        expect(total).toBe(1);
        expect(result).toHaveLength(1);
        expect(result[0]!.name).toBe('Filtered Shared (+1)');
    });

    it('returns no routes when sources allow-list excludes ropewiki', async () => {
        await db
            .insert('Route', {
                name: 'Orphan Route',
                type: 'Canyon',
                coordinates: { lat: 40.0, lon: -111.0 },
            })
            .run(conn);

        const filters = {
            routeTypes: null,
            difficulty: null,
            sources: [] as PageDataSource[],
        };
        // empty sources = no source filter (treated as any)
        expect(await countAllRoutes(conn, filters)).toBe(1);

        const noRopewiki = {
            routeTypes: null,
            difficulty: null,
            sources: ['other' as PageDataSource],
        };
        expect(await countAllRoutes(conn, noRopewiki)).toBe(0);
        expect(await getAllRoutesPage(conn, noRopewiki, 100, 0)).toEqual([]);
    });
});
