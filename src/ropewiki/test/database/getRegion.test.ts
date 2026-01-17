import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import getRegion from '../../database/getRegion';
import { RopewikiRegion } from '../../types/region';

describe('getRegion (integration)', () => {
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

    it('returns a region when found by name', async () => {
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
                    pageCount: 100,
                    level: 0,
                    overview: 'The world',
                    bestMonths: JSON.stringify([]),
                    isMajorRegion: false,
                    isTopLevelRegion: true,
                    url: 'https://ropewiki.com/World',
                },
                {
                    id: africaId,
                    parentRegion: 'World',
                    name: 'Africa',
                    latestRevisionDate,
                    pageCount: 50,
                    level: 1,
                    overview: 'The continent of Africa',
                    bestMonths: JSON.stringify([]),
                    isMajorRegion: true,
                    isTopLevelRegion: false,
                    url: 'https://ropewiki.com/Africa',
                },
            ])
            .run(conn);

        const result = await getRegion(conn, 'World');

        expect(result).toBeDefined();
        expect(result).toBeInstanceOf(RopewikiRegion);
        expect(result?.id).toBe(worldId);
        expect(result?.name).toBe('World');
        expect(result?.parentRegion).toBeUndefined();
        expect(result?.pageCount).toBe(100);
        expect(result?.level).toBe(0);
        expect(result?.overview).toBe('The world');
        expect(result?.bestMonths).toEqual([]);
        expect(result?.isMajorRegion).toBe(false);
        expect(result?.isTopLevelRegion).toBe(true);
        expect(result?.latestRevisionDate).toEqual(new Date(latestRevisionDate));
        expect(result?.url).toBe('https://ropewiki.com/World');
    });

    it('returns undefined when no region with that name is found', async () => {
        const result = await getRegion(conn, 'NonExistentRegion');
        expect(result).toBeUndefined();
    });

    it('returns the correct region when multiple regions exist', async () => {
        const worldId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
        const africaId = 'd1d9139d-38db-433c-b7cd-a28f79331667';
        const asiaId = 'e2e9240e-49ec-544d-c8de-b39f90442778';

        const latestRevisionDate = '2025-01-01T00:00:00' as db.TimestampString;

        await db
            .insert('RopewikiRegion', [
                {
                    id: worldId,
                    parentRegion: null,
                    name: 'World',
                    latestRevisionDate,
                    pageCount: 0,
                    level: 0,
                    overview: null,
                    bestMonths: JSON.stringify([]),
                    isMajorRegion: false,
                    isTopLevelRegion: true,
                    url: 'https://ropewiki.com/World',
                },
                {
                    id: africaId,
                    parentRegion: 'World',
                    name: 'Africa',
                    latestRevisionDate,
                    pageCount: 0,
                    level: 1,
                    overview: null,
                    bestMonths: JSON.stringify([]),
                    isMajorRegion: false,
                    isTopLevelRegion: false,
                    url: 'https://ropewiki.com/Africa',
                },
                {
                    id: asiaId,
                    parentRegion: 'World',
                    name: 'Asia',
                    latestRevisionDate,
                    pageCount: 0,
                    level: 1,
                    overview: null,
                    bestMonths: JSON.stringify([]),
                    isMajorRegion: false,
                    isTopLevelRegion: false,
                    url: 'https://ropewiki.com/Asia',
                },
            ])
            .run(conn);

        const result = await getRegion(conn, 'Africa');

        expect(result).toBeDefined();
        expect(result?.id).toBe(africaId);
        expect(result?.name).toBe('Africa');
        expect(result?.parentRegion).toBe('World');
    });

    it('correctly handles regions with bestMonths array', async () => {
        const worldId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
        const bestMonths = ['January', 'February', 'March'];

        const latestRevisionDate = '2025-01-01T00:00:00' as db.TimestampString;

        await db
            .insert('RopewikiRegion', [
                {
                    id: worldId,
                    parentRegion: null,
                    name: 'World',
                    latestRevisionDate,
                    pageCount: 0,
                    level: 0,
                    overview: null,
                    bestMonths: JSON.stringify(bestMonths),
                    isMajorRegion: false,
                    isTopLevelRegion: true,
                    url: 'https://ropewiki.com/World',
                },
            ])
            .run(conn);

        const result = await getRegion(conn, 'World');

        expect(result).toBeDefined();
        expect(result?.bestMonths).toEqual(bestMonths);
    });

    it('propagates errors from the database layer', async () => {
        const badPool = new Pool({
            user: process.env.TEST_USER,
            password: process.env.TEST_PASS,
            host: process.env.TEST_HOST,
            port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
            database: 'nonexistent_database_for_test_error_get_region',
        });

        await expect(getRegion(badPool, 'World')).rejects.toBeDefined();

        await badPool.end();
    });
});
