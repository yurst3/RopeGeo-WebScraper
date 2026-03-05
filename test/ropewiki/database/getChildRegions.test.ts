import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import getChildRegions from '../../../src/ropewiki/database/getChildRegions';
import { RopewikiRegion } from '../../../src/ropewiki/types/region';

describe('getChildRegions (integration)', () => {
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

    it('returns child region objects when parent has children', async () => {
        const worldId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
        const africaId = 'd1d9139d-38db-433c-b7cd-a28f79331667';
        const asiaId = 'e2e9240e-49ec-544d-c8de-b39f90442778';
        const europeId = 'f3f0351f-5afd-655e-d9ef-c4af01553889';

        const latestRevisionDate = '2025-01-01T00:00:00' as db.TimestampString;

        await db
            .insert('RopewikiRegion', [
                {
                    id: worldId,
                    parentRegion: null,
                    name: 'World',
                    latestRevisionDate,
                    rawPageCount: 0,
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
                    rawPageCount: 0,
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
                    rawPageCount: 0,
                    level: 1,
                    overview: null,
                    bestMonths: JSON.stringify([]),
                    isMajorRegion: false,
                    isTopLevelRegion: false,
                    url: 'https://ropewiki.com/Asia',
                },
                {
                    id: europeId,
                    parentRegion: 'World',
                    name: 'Europe',
                    latestRevisionDate,
                    rawPageCount: 0,
                    level: 1,
                    overview: null,
                    bestMonths: JSON.stringify([]),
                    isMajorRegion: false,
                    isTopLevelRegion: false,
                    url: 'https://ropewiki.com/Europe',
                },
            ])
            .run(conn);

        const result = await getChildRegions(conn, 'World');

        expect(result).toHaveLength(3);
        expect(result.every(r => r instanceof RopewikiRegion)).toBe(true);
        expect(result.map(r => r.name)).toContain('Africa');
        expect(result.map(r => r.name)).toContain('Asia');
        expect(result.map(r => r.name)).toContain('Europe');
        expect(result.find(r => r.name === 'Africa')?.id).toBe(africaId);
        expect(result.find(r => r.name === 'Asia')?.id).toBe(asiaId);
        expect(result.find(r => r.name === 'Europe')?.id).toBe(europeId);
    });

    it('returns empty array when parent has no children', async () => {
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
                    rawPageCount: 0,
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
                    rawPageCount: 0,
                    level: 1,
                    overview: null,
                    bestMonths: JSON.stringify([]),
                    isMajorRegion: false,
                    isTopLevelRegion: false,
                    url: 'https://ropewiki.com/Africa',
                },
            ])
            .run(conn);

        const result = await getChildRegions(conn, 'Africa');

        expect(result).toEqual([]);
    });

    it('returns empty array when parent region does not exist', async () => {
        const result = await getChildRegions(conn, 'NonExistentRegion');
        expect(result).toEqual([]);
    });

    it('only returns direct children, not grandchildren', async () => {
        const worldId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
        const africaId = 'd1d9139d-38db-433c-b7cd-a28f79331667';
        const kenyaId = 'a1a1234a-1234-1234-1234-123412341234';

        const latestRevisionDate = '2025-01-01T00:00:00' as db.TimestampString;

        await db
            .insert('RopewikiRegion', [
                {
                    id: worldId,
                    parentRegion: null,
                    name: 'World',
                    latestRevisionDate,
                    rawPageCount: 0,
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
                    rawPageCount: 0,
                    level: 1,
                    overview: null,
                    bestMonths: JSON.stringify([]),
                    isMajorRegion: false,
                    isTopLevelRegion: false,
                    url: 'https://ropewiki.com/Africa',
                },
                {
                    id: kenyaId,
                    parentRegion: 'Africa',
                    name: 'Kenya',
                    latestRevisionDate,
                    rawPageCount: 0,
                    level: 2,
                    overview: null,
                    bestMonths: JSON.stringify([]),
                    isMajorRegion: false,
                    isTopLevelRegion: false,
                    url: 'https://ropewiki.com/Kenya',
                },
            ])
            .run(conn);

        const result = await getChildRegions(conn, 'World');

        expect(result).toHaveLength(1);
        expect(result[0]?.name).toBe('Africa');
        expect(result.map(r => r.name)).not.toContain('Kenya');
    });

    it('returns child region objects in correct order', async () => {
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
                    rawPageCount: 0,
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
                    rawPageCount: 0,
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
                    rawPageCount: 0,
                    level: 1,
                    overview: null,
                    bestMonths: JSON.stringify([]),
                    isMajorRegion: false,
                    isTopLevelRegion: false,
                    url: 'https://ropewiki.com/Asia',
                },
            ])
            .run(conn);

        const result = await getChildRegions(conn, 'World');

        expect(result).toHaveLength(2);
        expect(result.map(r => r.name)).toContain('Africa');
        expect(result.map(r => r.name)).toContain('Asia');
        expect(result.every(r => r instanceof RopewikiRegion)).toBe(true);
    });

    it('propagates errors from the database layer', async () => {
        const badPool = new Pool({
            user: process.env.TEST_USER,
            password: process.env.TEST_PASS,
            host: process.env.TEST_HOST,
            port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
            database: 'nonexistent_database_for_test_error_get_child_regions',
        });

        await expect(getChildRegions(badPool, 'World')).rejects.toBeDefined();

        await badPool.end();
    });
});

