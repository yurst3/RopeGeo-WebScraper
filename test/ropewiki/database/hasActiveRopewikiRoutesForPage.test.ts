import { Pool } from 'pg';
import * as db from 'zapatos/db';
import { describe, it, expect, afterAll, beforeAll, afterEach } from '@jest/globals';
import hasActiveRopewikiRoutesForPage from '../../../src/ropewiki/database/hasActiveRopewikiRoutesForPage';

describe('hasActiveRopewikiRoutesForPage (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;
    const testRegionId = 'a3000001-0001-4000-8000-000000000001';
    const testPageId = 'b3000001-0001-4000-8000-000000000001';
    const testPageNoRouteId = 'b3000002-0002-4000-8000-000000000002';
    const testRouteId = 'c3000001-0001-4000-8000-000000000001';
    const testDeletedRouteId = 'c3000002-0002-4000-8000-000000000002';

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiRoute" WHERE "ropewikiPage" IN (${db.param(testPageId)}, ${db.param(testPageNoRouteId)})`.run(conn);
        await db.sql`DELETE FROM "Route" WHERE id IN (${db.param(testRouteId)}, ${db.param(testDeletedRouteId)})`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage" WHERE id IN (${db.param(testPageId)}, ${db.param(testPageNoRouteId)})`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(testRegionId)}`.run(conn);

        await db
            .insert('RopewikiRegion', {
                id: testRegionId,
                parentRegionName: null,
                name: 'HasActiveRoutesRegion',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/HasActiveRoutesRegion',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', [
                {
                    id: testPageId,
                    externalPageId: 'has-active-routes-page-1',
                    name: 'Has Active Routes Page',
                    region: testRegionId,
                    url: 'https://ropewiki.com/Has_Active_Routes_Page',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    quality: 1,
                    userVotes: 1,
                },
                {
                    id: testPageNoRouteId,
                    externalPageId: 'has-active-routes-page-2',
                    name: 'No Routes Page',
                    region: testRegionId,
                    url: 'https://ropewiki.com/No_Routes_Page',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    quality: 1,
                    userVotes: 1,
                },
            ])
            .run(conn);
        await db
            .insert('Route', [
                {
                    id: testRouteId,
                    name: 'Has Active Routes Route',
                    type: 'Canyon',
                    coordinates: { lat: 40.1, lon: -111.5 },
                },
                {
                    id: testDeletedRouteId,
                    name: 'Deleted Routes Route',
                    type: 'Canyon',
                    coordinates: { lat: 40.2, lon: -111.6 },
                },
            ])
            .run(conn);
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "RopewikiRoute" WHERE "ropewikiPage" IN (${db.param(testPageId)}, ${db.param(testPageNoRouteId)})`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiRoute" WHERE "ropewikiPage" IN (${db.param(testPageId)}, ${db.param(testPageNoRouteId)})`.run(conn);
        await db.sql`DELETE FROM "Route" WHERE id IN (${db.param(testRouteId)}, ${db.param(testDeletedRouteId)})`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage" WHERE id IN (${db.param(testPageId)}, ${db.param(testPageNoRouteId)})`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(testRegionId)}`.run(conn);
        await pool.end();
    });

    it('returns false when the page has no RopewikiRoute rows', async () => {
        const result = await hasActiveRopewikiRoutesForPage(conn, testPageNoRouteId);
        expect(result).toBe(false);
    });

    it('returns true when the page has an active RopewikiRoute', async () => {
        await db
            .insert('RopewikiRoute', {
                route: testRouteId,
                ropewikiPage: testPageId,
            })
            .run(conn);

        const result = await hasActiveRopewikiRoutesForPage(conn, testPageId);
        expect(result).toBe(true);
    });

    it('returns false when the only RopewikiRoute is soft-deleted', async () => {
        await db
            .insert('RopewikiRoute', {
                route: testDeletedRouteId,
                ropewikiPage: testPageId,
                deletedAt: '2025-06-01T00:00:00' as db.TimestampString,
            })
            .run(conn);

        const result = await hasActiveRopewikiRoutesForPage(conn, testPageId);
        expect(result).toBe(false);
    });
});
