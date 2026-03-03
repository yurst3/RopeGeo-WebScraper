import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import { getMapDataIds } from '../../../../src/fargate-tasks/generateTrailTiles/database/getMapDataIds';

describe('getMapDataIds (database)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;

    beforeAll(async () => {
        await db.sql`DELETE FROM "MapData"`.run(conn);
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "MapData"`.run(conn);
    });

    afterAll(async () => {
        await pool.end();
    });

    it('returns empty array when no MapData exists', async () => {
        const result = await getMapDataIds(conn);
        expect(result).toEqual([]);
    });

    it('returns id for MapData where errorMessage and deletedAt are null and geoJson is set', async () => {
        const mapDataId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        await db
            .insert('MapData', [{ id: mapDataId, sourceFileUrl: 'https://example.com/source', geoJson: 'https://example.com/geojson' }])
            .run(conn);

        const result = await getMapDataIds(conn);

        expect(result).toHaveLength(1);
        expect(result[0]).toBe(mapDataId);
    });

    it('excludes MapData where errorMessage is set', async () => {
        await db.insert('MapData', [{ sourceFileUrl: 'https://example.com/source', errorMessage: 'Parse error' }]).run(conn);

        const result = await getMapDataIds(conn);

        expect(result).toHaveLength(0);
    });

    it('excludes MapData where deletedAt is set', async () => {
        await db.insert('MapData', [{ sourceFileUrl: 'https://example.com/source', geoJson: 'https://example.com/geojson', deletedAt: new Date() }]).run(conn);

        const result = await getMapDataIds(conn);

        expect(result).toHaveLength(0);
    });
});
