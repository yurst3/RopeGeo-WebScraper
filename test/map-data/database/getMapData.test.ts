import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import getMapData from '../../../src/map-data/database/getMapData';
import upsertMapData from '../../../src/map-data/database/upsertMapData';
import MapData from '../../../src/map-data/types/mapData';

describe('getMapData (integration)', () => {
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

    it('returns MapData when a record exists for the given id', async () => {
        const mapDataId = '11111111-1111-1111-1111-111111111111';
        const inserted = new MapData(
            'https://example.com/file.gpx',
            'https://example.com/file.kml',
            'https://example.com/file.geojson',
            'https://example.com/file.mbtiles',
            mapDataId,
            'https://example.com/source.kml',
        );
        await upsertMapData(conn, inserted);

        const result = await getMapData(conn, mapDataId);

        expect(result).toBeInstanceOf(MapData);
        expect(result).not.toBeUndefined();
        expect(result!.id).toBe(mapDataId);
        expect(result!.gpx).toBe('https://example.com/file.gpx');
        expect(result!.kml).toBe('https://example.com/file.kml');
        expect(result!.geoJson).toBe('https://example.com/file.geojson');
        expect(result!.tiles).toBe('https://example.com/file.mbtiles');
        expect(result!.sourceFileUrl).toBe('https://example.com/source.kml');
        expect(result!.errorMessage).toBeUndefined();
    });

    it('returns null when no record exists for the given id', async () => {
        const nonExistentId = '99999999-9999-9999-9999-999999999999';

        const result = await getMapData(conn, nonExistentId);

        expect(result).toBeUndefined();
    });

    it('returns MapData with errorMessage when present', async () => {
        const mapDataId = '22222222-2222-2222-2222-222222222222';
        const inserted = new MapData(
            undefined,
            undefined,
            undefined,
            undefined,
            mapDataId,
            'https://example.com/source.kml',
            'Processing failed',
        );
        await upsertMapData(conn, inserted);

        const result = await getMapData(conn, mapDataId);

        expect(result).not.toBeUndefined();
        expect(result!.id).toBe(mapDataId);
        expect(result!.errorMessage).toBe('Processing failed');
        expect(result!.sourceFileUrl).toBe('https://example.com/source.kml');
    });

    it('returns null for a different id when one record exists', async () => {
        const mapDataId = '33333333-3333-3333-3333-333333333333';
        const inserted = new MapData(
            'https://example.com/file.gpx',
            undefined,
            undefined,
            undefined,
            mapDataId,
        );
        await upsertMapData(conn, inserted);

        const otherId = '44444444-4444-4444-4444-444444444444';
        const result = await getMapData(conn, otherId);

        expect(result).toBeUndefined();
    });
});
