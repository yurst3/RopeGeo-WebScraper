import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import { listRopewikiMapDataReprocessTargets } from '../../../src/map-data/database/listRopewikiMapDataReprocessTargets';

describe('listRopewikiMapDataReprocessTargets (database)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });
    const conn = pool;

    const regionId = 'd1000001-0001-4000-8000-000000000001';
    const pageStored = 'd2000001-0001-4000-8000-000000000001';
    const pageUrlOnly = 'd2000001-0001-4000-8000-000000000002';
    const routeStored = 'd3000001-0001-4000-8000-000000000001';
    const routeUrlOnly = 'd3000001-0001-4000-8000-000000000002';
    const mapDataStored = 'd4000001-0001-4000-8000-000000000001';
    const mapDataUrlOnly = 'd4000001-0001-4000-8000-000000000002';

    async function cleanup(): Promise<void> {
        await db.sql`DELETE FROM "RopewikiRoute" WHERE "ropewikiPage" IN (${db.param(pageStored)}::uuid, ${db.param(pageUrlOnly)}::uuid)`.run(
            conn,
        );
        await db.sql`DELETE FROM "RopewikiPage" WHERE id IN (${db.param(pageStored)}::uuid, ${db.param(pageUrlOnly)}::uuid)`.run(
            conn,
        );
        await db.sql`DELETE FROM "Route" WHERE id IN (${db.param(routeStored)}::uuid, ${db.param(routeUrlOnly)}::uuid)`.run(
            conn,
        );
        await db.sql`DELETE FROM "MapData" WHERE id IN (${db.param(mapDataStored)}::uuid, ${db.param(mapDataUrlOnly)}::uuid)`.run(
            conn,
        );
    }

    beforeAll(async () => {
        await cleanup();
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);
        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegionName: null,
                name: 'Map Data Reprocess Region',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/Map_Data_Reprocess_Region',
            })
            .run(conn);
    });

    afterEach(async () => {
        await cleanup();
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);
        await pool.end();
    });

    async function seedRoutes(): Promise<void> {
        await db
            .insert('MapData', [
                {
                    id: mapDataStored,
                    sourceFileUrl: 'https://example.com/stored.kml',
                    kml: 'source/stored.kml',
                },
                {
                    id: mapDataUrlOnly,
                    sourceFileUrl: 'https://example.com/url-only.kml',
                },
            ])
            .run(conn);

        await db
            .insert('Route', [
                {
                    id: routeStored,
                    name: 'Stored Source Route',
                    type: 'Canyon',
                    coordinates: { lat: 40.1, lon: -111.5 },
                },
                {
                    id: routeUrlOnly,
                    name: 'URL Only Route',
                    type: 'Canyon',
                    coordinates: { lat: 40.2, lon: -111.6 },
                },
            ])
            .run(conn);

        await db
            .insert('RopewikiPage', [
                {
                    id: pageStored,
                    externalPageId: 'map-reprocess-stored',
                    name: 'Page Stored',
                    region: regionId,
                    url: 'https://ropewiki.com/Page_Stored',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                },
                {
                    id: pageUrlOnly,
                    externalPageId: 'map-reprocess-url-only',
                    name: 'Page URL Only',
                    region: regionId,
                    url: 'https://ropewiki.com/Page_URL_Only',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                },
            ])
            .run(conn);

        await db
            .insert('RopewikiRoute', [
                {
                    route: routeStored,
                    ropewikiPage: pageStored,
                    mapData: mapDataStored,
                },
                {
                    route: routeUrlOnly,
                    ropewikiPage: pageUrlOnly,
                    mapData: mapDataUrlOnly,
                },
            ])
            .run(conn);
    }

    it('when onlyWithStoredKmlOrGpx is true, returns only rows with stored kml/gpx', async () => {
        await seedRoutes();
        const client = await pool.connect();
        try {
            const rows = await listRopewikiMapDataReprocessTargets(client, true);
            const ids = rows.map((r) => r.mapDataId).sort();
            expect(ids).toEqual([mapDataStored]);
            expect(rows[0]).toEqual({
                routeId: routeStored,
                pageId: pageStored,
                mapDataId: mapDataStored,
            });
        } finally {
            client.release();
        }
    });

    it('when onlyWithStoredKmlOrGpx is false, returns all linked MapData rows', async () => {
        await seedRoutes();
        const client = await pool.connect();
        try {
            const rows = await listRopewikiMapDataReprocessTargets(client, false);
            const ids = rows.map((r) => r.mapDataId).sort();
            expect(ids).toEqual([mapDataStored, mapDataUrlOnly].sort());
        } finally {
            client.release();
        }
    });

    it('filters to includeMapDataIds when provided', async () => {
        await seedRoutes();
        const client = await pool.connect();
        try {
            const rows = await listRopewikiMapDataReprocessTargets(client, false, [mapDataUrlOnly]);
            expect(rows).toEqual([
                {
                    routeId: routeUrlOnly,
                    pageId: pageUrlOnly,
                    mapDataId: mapDataUrlOnly,
                },
            ]);
        } finally {
            client.release();
        }
    });
});
