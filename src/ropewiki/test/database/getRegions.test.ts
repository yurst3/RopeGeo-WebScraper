import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import getRegions from '../../database/getRegions';

describe('getRegions (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;

    beforeAll(async () => {
        // Ensure table exists and is empty
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
    });

    afterEach(async () => {
        // Clean between tests
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
    });

    afterAll(async () => {
        await pool.end();
    });

    it('returns regions when select succeeds', async () => {
        const worldId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
        const africaId = 'd1d9139d-38db-433c-b7cd-a28f79331667';

        const latestRevisionDate = '2025-01-01T00:00:00' as db.TimestampString;

        await db
            .insert('RopewikiRegion', [
                {
                    id: worldId,
                    parentRegion: null,
                    name: 'World',
                    latestRevisionDate,
                },
                {
                    id: africaId,
                    parentRegion: worldId,
                    name: 'Africa',
                    latestRevisionDate,
                },
            ])
            .run(conn);

        const result = await getRegions(conn);

        expect(result.length).toBe(2);

        const world = result.find((r) => r.id === worldId) as s.RopewikiRegion.JSONSelectable;
        const africa = result.find((r) => r.id === africaId) as s.RopewikiRegion.JSONSelectable;

        expect(world.name).toBe('World');
        expect(world.parentRegion).toBeNull();
        expect(world.latestRevisionDate).toBe(latestRevisionDate);

        expect(africa.name).toBe('Africa');
        expect(africa.parentRegion).toBe(worldId);
        expect(africa.latestRevisionDate).toBe(latestRevisionDate);
    });

    it('throws when select fails', async () => {
        const badPool = new Pool({
            user: process.env.TEST_USER,
            password: process.env.TEST_PASS,
            host: process.env.TEST_HOST,
            port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
            database: 'nonexistent_database_for_test_error_regions',
        });

        await expect(getRegions(badPool)).rejects.toBeDefined();

        await badPool.end();
    });
});
