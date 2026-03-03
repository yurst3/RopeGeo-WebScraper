import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { getRoutes } from '../../../../src/fargate-tasks/generateRouteMarkerTiles/database/getRoutes';

describe('getRoutes (generateRouteMarkerTiles database)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;

    beforeAll(async () => {
        await db.sql`DELETE FROM "Route"`.run(conn);
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "Route"`.run(conn);
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

        const result = await getRoutes(conn);

        expect(result.length).toBe(1);
        expect(result[0].name).toBe('Active Route');
        expect(result[0].type).toBe('Canyon');
        expect(result[0].deletedAt).toBeNull();
    });

    it('returns all non-deleted routes with correct shape', async () => {
        await db
            .insert('Route', [
                { name: 'Route A', type: 'Canyon', coordinates: { lat: 40.0, lon: -111.0 } },
                { name: 'Route B', type: 'Cave', coordinates: { lat: 41.0, lon: -112.0 } },
            ])
            .run(conn);

        const result = await getRoutes(conn);

        expect(result.length).toBe(2);
        const names = result.map((r: s.Route.JSONSelectable) => r.name).sort();
        expect(names).toEqual(['Route A', 'Route B']);
        result.forEach((row: s.Route.JSONSelectable) => {
            expect(row).toHaveProperty('id');
            expect(row).toHaveProperty('name');
            expect(row).toHaveProperty('type');
            expect(row).toHaveProperty('coordinates');
            expect(row.deletedAt).toBeNull();
        });
    });

    it('returns empty array when no routes exist', async () => {
        const result = await getRoutes(conn);
        expect(result).toEqual([]);
    });
});
