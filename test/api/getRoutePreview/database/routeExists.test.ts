import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import routeExists from '../../../../src/api/getRoutePreview/database/routeExists';

describe('routeExists (integration)', () => {
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

    it('returns true when a non-deleted route exists with the given id', async () => {
        const routeId = '11111111-1111-1111-1111-111111111111';
        await db
            .insert('Route', {
                id: routeId,
                name: 'Test Route',
                type: 'Canyon',
                coordinates: { lat: 40.1, lon: -111.5 },
            })
            .run(conn);

        const result = await routeExists(conn, routeId);

        expect(result).toBe(true);
    });

    it('returns false when no route exists with the given id', async () => {
        const result = await routeExists(conn, '99999999-9999-9999-9999-999999999999');

        expect(result).toBe(false);
    });

    it('returns false when route exists but is deleted (deletedAt set)', async () => {
        const routeId = '22222222-2222-2222-2222-222222222222';
        await db
            .insert('Route', {
                id: routeId,
                name: 'Deleted Route',
                type: 'Cave',
                coordinates: { lat: 40.2, lon: -111.6 },
                deletedAt: new Date('2025-01-01T00:00:00Z'),
            })
            .run(conn);

        const result = await routeExists(conn, routeId);

        expect(result).toBe(false);
    });
});
