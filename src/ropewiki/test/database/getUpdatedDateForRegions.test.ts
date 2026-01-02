import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import getUpdatedDateForRegions from '../../database/getUpdatedDateForRegions';

describe('getUpdatedDateForRegions (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
    });

    afterAll(async () => {
        await pool.end();
    });

    it('returns the updatedAt date when World region is found', async () => {
        const worldId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
        const updatedAtTs = '2025-01-02T12:34:56' as db.TimestampString;

        await db
            .insert('RopewikiRegion', {
                id: worldId,
                parentRegion: null,
                name: 'World',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                updatedAt: updatedAtTs,
            })
            .run(conn);

        const result = await getUpdatedDateForRegions(conn);

        expect(result).not.toBeNull();
        expect(result instanceof Date).toBe(true);
        expect(result!.toISOString()).toBe(new Date(updatedAtTs).toISOString());
    });

    it('returns null when World region is not found', async () => {
        // No rows inserted, table is empty
        const result = await getUpdatedDateForRegions(conn);
        expect(result).toBeNull();
    });

    it('propagates database errors', async () => {
        const badPool = new Pool({
            user: process.env.TEST_USER,
            password: process.env.TEST_PASS,
            host: process.env.TEST_HOST,
            port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
            database: 'nonexistent_database_for_test_error_updated_date',
        });

        await expect(getUpdatedDateForRegions(badPool)).rejects.toBeDefined();

        await badPool.end();
    });
});


