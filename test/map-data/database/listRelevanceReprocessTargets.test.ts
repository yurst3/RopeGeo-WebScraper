import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import { PointLegendItem } from 'ropegeo-common/models';
import { listRelevanceReprocessTargets } from '../../../src/map-data/database/listRelevanceReprocessTargets';
import replaceMapDataLegendItems from '../../../src/map-data/database/replaceMapDataLegendItems';

describe('listRelevanceReprocessTargets (database)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });
    const conn = pool;

    const regionId = 'c1000001-0001-4000-8000-000000000001';
    const pageWithLegend = 'c2000001-0001-4000-8000-000000000001';
    const pageNoLegend = 'c2000001-0001-4000-8000-000000000002';
    const routeWithLegend = 'c3000001-0001-4000-8000-000000000001';
    const routeNoLegend = 'c3000001-0001-4000-8000-000000000002';
    const mapDataWithLegend = 'c4000001-0001-4000-8000-000000000001';
    const mapDataNoLegend = 'c4000001-0001-4000-8000-000000000002';

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiRoute" WHERE "ropewikiPage" IN (${db.param(pageWithLegend)}::uuid, ${db.param(pageNoLegend)}::uuid)`.run(
            conn,
        );
        await db.sql`DELETE FROM "RopewikiPage" WHERE id IN (${db.param(pageWithLegend)}::uuid, ${db.param(pageNoLegend)}::uuid)`.run(
            conn,
        );
        await db.sql`DELETE FROM "Route" WHERE id IN (${db.param(routeWithLegend)}::uuid, ${db.param(routeNoLegend)}::uuid)`.run(
            conn,
        );
        await db.sql`DELETE FROM "MapData" WHERE id IN (${db.param(mapDataWithLegend)}::uuid, ${db.param(mapDataNoLegend)}::uuid)`.run(
            conn,
        );
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);

        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegionName: null,
                name: 'Relevance Reprocess Region',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/Relevance_Reprocess_Region',
            })
            .run(conn);
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "RopewikiRoute" WHERE "ropewikiPage" IN (${db.param(pageWithLegend)}::uuid, ${db.param(pageNoLegend)}::uuid)`.run(
            conn,
        );
        await db.sql`DELETE FROM "RopewikiPage" WHERE id IN (${db.param(pageWithLegend)}::uuid, ${db.param(pageNoLegend)}::uuid)`.run(
            conn,
        );
        await db.sql`DELETE FROM "Route" WHERE id IN (${db.param(routeWithLegend)}::uuid, ${db.param(routeNoLegend)}::uuid)`.run(
            conn,
        );
        await db.sql`DELETE FROM "MapData" WHERE id IN (${db.param(mapDataWithLegend)}::uuid, ${db.param(mapDataNoLegend)}::uuid)`.run(
            conn,
        );
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);
        await pool.end();
    });

    it('returns pages whose preferred MapData has legend items and skips MapData without legends', async () => {
        await db
            .insert('MapData', [
                { id: mapDataWithLegend, sourceFileUrl: 'https://example.com/with.gpx' },
                { id: mapDataNoLegend, sourceFileUrl: 'https://example.com/none.gpx' },
            ])
            .run(conn);

        await replaceMapDataLegendItems(conn, mapDataWithLegend, {
            m1: new PointLegendItem('m1', 'Trailhead', { lat: 40, lon: -111 }, 'campground'),
        });

        await db
            .insert('Route', [
                {
                    id: routeWithLegend,
                    name: 'With Legend Route',
                    type: 'Canyon',
                    coordinates: { lat: 40.1, lon: -111.5 },
                },
                {
                    id: routeNoLegend,
                    name: 'No Legend Route',
                    type: 'Canyon',
                    coordinates: { lat: 40.2, lon: -111.6 },
                },
            ])
            .run(conn);

        await db
            .insert('RopewikiPage', [
                {
                    id: pageWithLegend,
                    externalPageId: 'reprocess-with-legend',
                    name: 'Page With Legend',
                    region: regionId,
                    url: 'https://ropewiki.com/Page_With_Legend',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                },
                {
                    id: pageNoLegend,
                    externalPageId: 'reprocess-no-legend',
                    name: 'Page No Legend',
                    region: regionId,
                    url: 'https://ropewiki.com/Page_No_Legend',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                },
            ])
            .run(conn);

        await db
            .insert('RopewikiRoute', [
                {
                    route: routeWithLegend,
                    ropewikiPage: pageWithLegend,
                    mapData: mapDataWithLegend,
                },
                {
                    route: routeNoLegend,
                    ropewikiPage: pageNoLegend,
                    mapData: mapDataNoLegend,
                },
            ])
            .run(conn);

        const targets = await listRelevanceReprocessTargets(conn);
        const matching = targets.filter(
            (t) => t.pageId === pageWithLegend || t.pageId === pageNoLegend,
        );

        expect(matching).toEqual([{ pageId: pageWithLegend, mapDataId: mapDataWithLegend }]);
    });
});
