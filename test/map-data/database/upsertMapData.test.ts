import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import upsertMapData from '../../../src/map-data/database/upsertMapData';
import MapData from '../../../src/map-data/types/mapData';

describe('upsertMapData (integration)', () => {
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
        await db.sql`DELETE FROM "MapData"`.run(conn);
    });

    afterEach(async () => {
        // Clean between tests
        await db.sql`DELETE FROM "MapData"`.run(conn);
    });

    afterAll(async () => {
        await pool.end();
    });

    it('inserts a new MapData record when id is not provided', async () => {
        const mapData = new MapData(
            'https://example.com/file.gpx',
            'https://example.com/file.kml',
            'https://example.com/file.geojson',
            'https://example.com/file.mbtiles',
        );

        const result = await upsertMapData(conn, mapData);

        expect(result).toBeInstanceOf(MapData);
        expect(result.id).toBeDefined();
        expect(result.gpxUrl).toBe('https://example.com/file.gpx');
        expect(result.kmlUrl).toBe('https://example.com/file.kml');
        expect(result.geoJsonUrl).toBe('https://example.com/file.geojson');
        expect(result.vectorTileUrl).toBe('https://example.com/file.mbtiles');
        expect(result.deletedAt).toBeUndefined();

        // Verify it was actually inserted in the database
        const dbRow = await db.selectOne('MapData', { id: result.id }).run(conn);
        expect(dbRow).toBeDefined();
        expect(dbRow!.gpxUrl).toBe('https://example.com/file.gpx');
        expect(dbRow!.kmlUrl).toBe('https://example.com/file.kml');
        expect(dbRow!.geoJsonUrl).toBe('https://example.com/file.geojson');
        expect(dbRow!.vectorTileUrl).toBe('https://example.com/file.mbtiles');
    });

    it('inserts a new MapData record when id is provided', async () => {
        const mapDataId = '11111111-1111-1111-1111-111111111111';
        const mapData = new MapData(
            'https://example.com/file.gpx',
            'https://example.com/file.kml',
            'https://example.com/file.geojson',
            'https://example.com/file.mbtiles',
            undefined,
            mapDataId,
        );

        const result = await upsertMapData(conn, mapData);

        expect(result).toBeInstanceOf(MapData);
        expect(result.id).toBe(mapDataId);
        expect(result.gpxUrl).toBe('https://example.com/file.gpx');
        expect(result.kmlUrl).toBe('https://example.com/file.kml');
        expect(result.geoJsonUrl).toBe('https://example.com/file.geojson');
        expect(result.vectorTileUrl).toBe('https://example.com/file.mbtiles');
    });

    it('updates an existing MapData record when id is provided', async () => {
        const mapDataId = '11111111-1111-1111-1111-111111111111';
        
        // Insert initial record
        const initialMapData = new MapData(
            'https://example.com/old.gpx',
            'https://example.com/old.kml',
            'https://example.com/old.geojson',
            'https://example.com/old.mbtiles',
            undefined,
            mapDataId,
        );
        await upsertMapData(conn, initialMapData);

        // Wait a bit to ensure updatedAt changes
        await new Promise(resolve => setTimeout(resolve, 10));

        // Update the record
        const updatedMapData = new MapData(
            'https://example.com/new.gpx',
            'https://example.com/new.kml',
            'https://example.com/new.geojson',
            'https://example.com/new.mbtiles',
            undefined,
            mapDataId,
        );
        const result = await upsertMapData(conn, updatedMapData);

        expect(result).toBeInstanceOf(MapData);
        expect(result.id).toBe(mapDataId);
        expect(result.gpxUrl).toBe('https://example.com/new.gpx');
        expect(result.kmlUrl).toBe('https://example.com/new.kml');
        expect(result.geoJsonUrl).toBe('https://example.com/new.geojson');
        expect(result.vectorTileUrl).toBe('https://example.com/new.mbtiles');

        // Verify the old values are gone
        const dbRow = await db.selectOne('MapData', { id: mapDataId }).run(conn);
        expect(dbRow!.gpxUrl).toBe('https://example.com/new.gpx');
        expect(dbRow!.kmlUrl).toBe('https://example.com/new.kml');
        expect(dbRow!.geoJsonUrl).toBe('https://example.com/new.geojson');
        expect(dbRow!.vectorTileUrl).toBe('https://example.com/new.mbtiles');
    });

    it('handles null/undefined values correctly', async () => {
        const mapData = new MapData(
            undefined,
            undefined,
            undefined,
            undefined,
        );

        const result = await upsertMapData(conn, mapData);

        expect(result).toBeInstanceOf(MapData);
        expect(result.id).toBeDefined();
        expect(result.gpxUrl).toBeUndefined();
        expect(result.kmlUrl).toBeUndefined();
        expect(result.geoJsonUrl).toBeUndefined();
        expect(result.vectorTileUrl).toBeUndefined();

        // Verify null values in database
        const dbRow = await db.selectOne('MapData', { id: result.id }).run(conn);
        expect(dbRow!.gpxUrl).toBeNull();
        expect(dbRow!.kmlUrl).toBeNull();
        expect(dbRow!.geoJsonUrl).toBeNull();
        expect(dbRow!.vectorTileUrl).toBeNull();
    });

    it('updates deletedAt field', async () => {
        const mapDataId = '11111111-1111-1111-1111-111111111111';
        
        // Insert initial record
        const initialMapData = new MapData(
            'https://example.com/file.gpx',
            'https://example.com/file.kml',
            'https://example.com/file.geojson',
            'https://example.com/file.mbtiles',
            undefined,
            mapDataId,
        );
        await upsertMapData(conn, initialMapData);

        // Update with deletedAt
        const deletedDate = new Date();
        const deletedMapData = new MapData(
            'https://example.com/file.gpx',
            'https://example.com/file.kml',
            'https://example.com/file.geojson',
            'https://example.com/file.mbtiles',
            deletedDate,
            mapDataId,
        );
        const result = await upsertMapData(conn, deletedMapData);

        expect(result.deletedAt).toBeDefined();
        expect(result.deletedAt).toEqual(deletedDate);

        // Verify in database
        const dbRow = await db.selectOne('MapData', { id: mapDataId }).run(conn);
        expect(dbRow!.deletedAt).toBeDefined();
        expect(new Date(dbRow!.deletedAt!)).toEqual(deletedDate);
    });

    it('updates updatedAt timestamp on upsert', async () => {
        const mapDataId = '11111111-1111-1111-1111-111111111111';
        
        // Insert initial record
        const initialMapData = new MapData(
            'https://example.com/file.gpx',
            'https://example.com/file.kml',
            'https://example.com/file.geojson',
            'https://example.com/file.mbtiles',
            undefined,
            mapDataId,
        );
        const initialResult = await upsertMapData(conn, initialMapData);
        
        // Get initial updatedAt
        const initialDbRow = await db.selectOne('MapData', { id: mapDataId }).run(conn);
        const initialUpdatedAt = new Date(initialDbRow!.updatedAt);

        // Wait a bit to ensure updatedAt changes
        await new Promise(resolve => setTimeout(resolve, 10));

        // Update the record
        const updatedMapData = new MapData(
            'https://example.com/new.gpx',
            'https://example.com/new.kml',
            'https://example.com/new.geojson',
            'https://example.com/new.mbtiles',
            undefined,
            mapDataId,
        );
        await upsertMapData(conn, updatedMapData);

        // Verify updatedAt was updated
        const updatedDbRow = await db.selectOne('MapData', { id: mapDataId }).run(conn);
        const updatedUpdatedAt = new Date(updatedDbRow!.updatedAt);
        expect(updatedUpdatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
    });

    it('handles partial updates (only some fields)', async () => {
        const mapDataId = '11111111-1111-1111-1111-111111111111';
        
        // Insert initial record with all fields
        const initialMapData = new MapData(
            'https://example.com/file.gpx',
            'https://example.com/file.kml',
            'https://example.com/file.geojson',
            'https://example.com/file.mbtiles',
            undefined,
            mapDataId,
        );
        await upsertMapData(conn, initialMapData);

        // Update only some fields
        const partialMapData = new MapData(
            'https://example.com/new.gpx',
            undefined, // Keep kmlUrl as is
            'https://example.com/new.geojson',
            undefined, // Keep vectorTileUrl as is
            undefined,
            mapDataId,
        );
        const result = await upsertMapData(conn, partialMapData);

        expect(result.gpxUrl).toBe('https://example.com/new.gpx');
        expect(result.geoJsonUrl).toBe('https://example.com/new.geojson');
        // kmlUrl and vectorTileUrl should be null/undefined after update
        expect(result.kmlUrl).toBeUndefined();
        expect(result.vectorTileUrl).toBeUndefined();
    });

    it('propagates errors from the database layer', async () => {
        const badPool = new Pool({
            user: process.env.TEST_USER,
            password: process.env.TEST_PASS,
            host: process.env.TEST_HOST,
            port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
            database: 'nonexistent_database_for_test_error_upsert_map_data',
        });

        const mapData = new MapData(
            'https://example.com/file.gpx',
            'https://example.com/file.kml',
            'https://example.com/file.geojson',
            'https://example.com/file.mbtiles',
        );

        await expect(upsertMapData(badPool, mapData)).rejects.toBeDefined();

        await badPool.end();
    });
});
