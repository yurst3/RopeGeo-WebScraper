import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import getRopewikiRegionRoutes from '../../../../src/api/getRoutes/database/getRopewikiRegionRoutes';

describe('getRopewikiRegionRoutes (integration)', () => {
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
    });

    afterAll(async () => {
        await pool.end();
    });

    it('returns only routes linked to Ropewiki pages in the given region and its descendants', async () => {
        const regionId = 'd1000001-0001-4000-8000-000000000001';
        const pageId = 'd2000002-0002-4000-8000-000000000002';
        const routeId = 'd3000003-0003-4000-8000-000000000003';
        const otherRegionId = 'd4000004-0004-4000-8000-000000000004';
        const otherPageId = 'd5000005-0005-4000-8000-000000000005';
        const otherRouteId = 'd6000006-0006-4000-8000-000000000006';

        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegionName: null,
                name: 'GetRoutesFilterRegion',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/GetRoutesFilterRegion',
            })
            .run(conn);
        await db
            .insert('RopewikiRegion', {
                id: otherRegionId,
                parentRegionName: null,
                name: 'GetRoutesFilterOtherRegion',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/GetRoutesFilterOtherRegion',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: 'getroutes-filter-page',
                name: 'GetRoutesFilterPage',
                region: regionId,
                url: 'https://ropewiki.com/GetRoutesFilterPage',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: otherPageId,
                pageId: 'getroutes-filter-other-page',
                name: 'GetRoutesFilterOtherPage',
                region: otherRegionId,
                url: 'https://ropewiki.com/GetRoutesFilterOtherPage',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);
        await db
            .insert('Route', [
                {
                    id: routeId,
                    name: 'Route In Region',
                    type: 'Canyon',
                    coordinates: { lat: 40.1, lon: -111.5 },
                },
                {
                    id: otherRouteId,
                    name: 'Route In Other Region',
                    type: 'Cave',
                    coordinates: { lat: 41.0, lon: -112.0 },
                },
            ])
            .run(conn);
        await db
            .insert('RopewikiRoute', [
                { route: routeId, ropewikiPage: pageId },
                { route: otherRouteId, ropewikiPage: otherPageId },
            ])
            .run(conn);

        try {
            const filtered = await getRopewikiRegionRoutes(conn, regionId);
            expect(filtered.length).toBe(1);
            expect(filtered[0]).toBeDefined();
            expect(filtered[0]!.id).toBe(routeId);
            expect(filtered[0]!.name).toBe('Route In Region');
        } finally {
            await db.sql`DELETE FROM "RopewikiRoute" WHERE route = ${db.param(routeId)}::uuid OR route = ${db.param(otherRouteId)}::uuid`.run(conn);
            await db.sql`DELETE FROM "Route" WHERE id = ${db.param(routeId)}::uuid OR id = ${db.param(otherRouteId)}::uuid`.run(conn);
            await db.sql`DELETE FROM "RopewikiPage" WHERE id = ${db.param(pageId)}::uuid OR id = ${db.param(otherPageId)}::uuid`.run(conn);
            await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid OR id = ${db.param(otherRegionId)}::uuid`.run(conn);
        }
    });

    it('returns routes for pages in descendant regions when querying by parent region', async () => {
        const parentRegionId = 'd7000007-0007-4000-8000-000000000007';
        const parentRegionName = 'GetRoutesParentRegion';
        const childRegionId = 'd8000008-0008-4000-8000-000000000008';
        const pageInChildId = 'd9000009-0009-4000-8000-000000000009';
        const routeInChildId = 'da00000a-000a-4000-8000-00000000000a';

        await db
            .insert('RopewikiRegion', {
                id: parentRegionId,
                parentRegionName: null,
                name: parentRegionName,
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/GetRoutesParentRegion',
            })
            .run(conn);
        await db
            .insert('RopewikiRegion', {
                id: childRegionId,
                parentRegionName: parentRegionName,
                name: 'GetRoutesChildRegion',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 1,
                bestMonths: [],
                url: 'https://ropewiki.com/GetRoutesChildRegion',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageInChildId,
                pageId: 'getroutes-page-in-child',
                name: 'Page In Child Region',
                region: childRegionId,
                url: 'https://ropewiki.com/PageInChildRegion',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);
        await db
            .insert('Route', {
                id: routeInChildId,
                name: 'Route In Child Region',
                type: 'Canyon',
                coordinates: { lat: 40.3, lon: -111.7 },
            })
            .run(conn);
        await db
            .insert('RopewikiRoute', { route: routeInChildId, ropewikiPage: pageInChildId })
            .run(conn);

        try {
            const result = await getRopewikiRegionRoutes(conn, parentRegionId);
            expect(result.length).toBe(1);
            expect(result[0]).toBeDefined();
            expect(result[0]!.id).toBe(routeInChildId);
            expect(result[0]!.name).toBe('Route In Child Region');
        } finally {
            await db.sql`DELETE FROM "RopewikiRoute" WHERE route = ${db.param(routeInChildId)}::uuid`.run(conn);
            await db.sql`DELETE FROM "Route" WHERE id = ${db.param(routeInChildId)}::uuid`.run(conn);
            await db.sql`DELETE FROM "RopewikiPage" WHERE id = ${db.param(pageInChildId)}::uuid`.run(conn);
            await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(childRegionId)}::uuid OR id = ${db.param(parentRegionId)}::uuid`.run(conn);
        }
    });
});
