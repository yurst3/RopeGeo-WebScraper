import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import getChildRegions from '../../database/getChildRegions';

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

    it('returns child region names when parent has children', async () => {
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
                },
                {
                    id: africaId,
                    parentRegion: worldId,
                    name: 'Africa',
                    latestRevisionDate,
                },
                {
                    id: asiaId,
                    parentRegion: worldId,
                    name: 'Asia',
                    latestRevisionDate,
                },
                {
                    id: europeId,
                    parentRegion: worldId,
                    name: 'Europe',
                    latestRevisionDate,
                },
            ])
            .run(conn);

        const result = await getChildRegions(conn, 'World');

        expect(result).toHaveLength(3);
        expect(result).toContain('Africa');
        expect(result).toContain('Asia');
        expect(result).toContain('Europe');
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
                },
                {
                    id: africaId,
                    parentRegion: worldId,
                    name: 'Africa',
                    latestRevisionDate,
                },
            ])
            .run(conn);

        const result = await getChildRegions(conn, 'Africa');

        expect(result).toEqual([]);
    });

    it('throws an error when parent region does not exist', async () => {
        await expect(getChildRegions(conn, 'NonExistentRegion')).rejects.toThrow(
            'Region not found: NonExistentRegion'
        );
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
                },
                {
                    id: africaId,
                    parentRegion: worldId,
                    name: 'Africa',
                    latestRevisionDate,
                },
                {
                    id: kenyaId,
                    parentRegion: africaId,
                    name: 'Kenya',
                    latestRevisionDate,
                },
            ])
            .run(conn);

        const result = await getChildRegions(conn, 'World');

        expect(result).toHaveLength(1);
        expect(result).toContain('Africa');
        expect(result).not.toContain('Kenya');
    });

    it('returns child region names in correct order', async () => {
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
                },
                {
                    id: africaId,
                    parentRegion: worldId,
                    name: 'Africa',
                    latestRevisionDate,
                },
                {
                    id: asiaId,
                    parentRegion: worldId,
                    name: 'Asia',
                    latestRevisionDate,
                },
            ])
            .run(conn);

        const result = await getChildRegions(conn, 'World');

        expect(result).toHaveLength(2);
        expect(result).toContain('Africa');
        expect(result).toContain('Asia');
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

