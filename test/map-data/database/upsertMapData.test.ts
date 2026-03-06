import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach, jest } from '@jest/globals';
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
        expect(result.gpx).toBe('https://example.com/file.gpx');
        expect(result.kml).toBe('https://example.com/file.kml');
        expect(result.geoJson).toBe('https://example.com/file.geojson');
        expect(result.vectorTile).toBe('https://example.com/file.mbtiles');

        // Verify it was actually inserted in the database
        const resultId = result.id;
        if (!resultId) {
            throw new Error('Result id is undefined');
        }
        const dbRow = await db.selectOne('MapData', { id: resultId }).run(conn);
        expect(dbRow).toBeDefined();
        expect(dbRow!.gpx).toBe('https://example.com/file.gpx');
        expect(dbRow!.kml).toBe('https://example.com/file.kml');
        expect(dbRow!.geoJson).toBe('https://example.com/file.geojson');
        expect(dbRow!.vectorTile).toBe('https://example.com/file.mbtiles');
    });

    it('inserts a new MapData record when id is provided', async () => {
        const mapDataId = '11111111-1111-1111-1111-111111111111';
        const mapData = new MapData(
            'https://example.com/file.gpx',
            'https://example.com/file.kml',
            'https://example.com/file.geojson',
            'https://example.com/file.mbtiles',
            mapDataId,
        );

        const result = await upsertMapData(conn, mapData);

        expect(result).toBeInstanceOf(MapData);
        expect(result.id).toBe(mapDataId);
        expect(result.gpx).toBe('https://example.com/file.gpx');
        expect(result.kml).toBe('https://example.com/file.kml');
        expect(result.geoJson).toBe('https://example.com/file.geojson');
        expect(result.vectorTile).toBe('https://example.com/file.mbtiles');
    });

    it('updates an existing MapData record when id is provided', async () => {
        const mapDataId = '11111111-1111-1111-1111-111111111111';
        
        // Insert initial record
        const initialMapData = new MapData(
            'https://example.com/old.gpx',
            'https://example.com/old.kml',
            'https://example.com/old.geojson',
            'https://example.com/old.mbtiles',
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
            mapDataId,
        );
        const result = await upsertMapData(conn, updatedMapData);

        expect(result).toBeInstanceOf(MapData);
        expect(result.id).toBe(mapDataId);
        expect(result.gpx).toBe('https://example.com/new.gpx');
        expect(result.kml).toBe('https://example.com/new.kml');
        expect(result.geoJson).toBe('https://example.com/new.geojson');
        expect(result.vectorTile).toBe('https://example.com/new.mbtiles');

        // Verify the old values are gone
        const dbRow = await db.selectOne('MapData', { id: mapDataId }).run(conn);
        expect(dbRow!.gpx).toBe('https://example.com/new.gpx');
        expect(dbRow!.kml).toBe('https://example.com/new.kml');
        expect(dbRow!.geoJson).toBe('https://example.com/new.geojson');
        expect(dbRow!.vectorTile).toBe('https://example.com/new.mbtiles');
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
        expect(result.gpx).toBeUndefined();
        expect(result.kml).toBeUndefined();
        expect(result.geoJson).toBeUndefined();
        expect(result.vectorTile).toBeUndefined();

        // Verify null values in database
        const resultId = result.id;
        if (!resultId) {
            throw new Error('Result id is undefined');
        }
        const dbRow = await db.selectOne('MapData', { id: resultId }).run(conn);
        expect(dbRow!.gpx).toBeNull();
        expect(dbRow!.kml).toBeNull();
        expect(dbRow!.geoJson).toBeNull();
        expect(dbRow!.vectorTile).toBeNull();
    });


    it('updates updatedAt timestamp on upsert', async () => {
        const mapDataId = '11111111-1111-1111-1111-111111111111';
        
        // Insert initial record
        const initialMapData = new MapData(
            'https://example.com/file.gpx',
            'https://example.com/file.kml',
            'https://example.com/file.geojson',
            'https://example.com/file.mbtiles',
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
            mapDataId,
        );
        await upsertMapData(conn, initialMapData);

        // Update only some fields
        const partialMapData = new MapData(
            'https://example.com/new.gpx',
            undefined, // Keep kml as is
            'https://example.com/new.geojson',
            undefined, // Keep vectorTile as is
            mapDataId,
        );
        const result = await upsertMapData(conn, partialMapData);

        expect(result.gpx).toBe('https://example.com/new.gpx');
        expect(result.geoJson).toBe('https://example.com/new.geojson');
        // kml and vectorTile should be null/undefined after update
        expect(result.kml).toBeUndefined();
        expect(result.vectorTile).toBeUndefined();
    });

    it('returns existing row and logs warning when allowUpdates is false (does not update)', async () => {
        const mapDataId = '22222222-2222-2222-2222-222222222222';
        const initialMapData = new MapData(
            'https://example.com/original.gpx',
            'https://example.com/original.kml',
            'https://example.com/original.geojson',
            'https://example.com/original.mbtiles',
            mapDataId,
        );
        await upsertMapData(conn, initialMapData);

        await db.sql`
            UPDATE "MapData"
            SET "allowUpdates" = false
            WHERE id = ${db.param(mapDataId)}::uuid
        `.run(conn);

        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const updatedMapData = new MapData(
            'https://example.com/should-not-apply.gpx',
            'https://example.com/should-not-apply.kml',
            'https://example.com/should-not-apply.geojson',
            'https://example.com/should-not-apply.mbtiles',
            mapDataId,
        );
        const result = await upsertMapData(conn, updatedMapData);

        expect(result.id).toBe(mapDataId);
        expect(result.gpx).toBe('https://example.com/original.gpx');
        expect(result.kml).toBe('https://example.com/original.kml');
        expect(warnSpy).toHaveBeenCalledWith(`MapData row ${mapDataId} not updated: allowUpdates is false`);
        warnSpy.mockRestore();

        const dbRow = await db.selectOne('MapData', { id: mapDataId }).run(conn);
        expect(dbRow!.gpx).toBe('https://example.com/original.gpx');
        expect(dbRow!.kml).toBe('https://example.com/original.kml');
    });

    it('skips upserting when existing data has no error and incoming data has an error', async () => {
        const mapDataId = '11111111-1111-1111-1111-111111111111';
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        
        // Insert initial successful record (no errorMessage)
        const initialMapData = new MapData(
            'https://example.com/file.gpx',
            'https://example.com/file.kml',
            'https://example.com/file.geojson',
            'https://example.com/file.mbtiles',
            mapDataId,
            'https://example.com/source.kml',
        );
        const initialResult = await upsertMapData(conn, initialMapData);
        expect(initialResult.errorMessage).toBeUndefined();

        // Wait a bit to ensure updatedAt would change if we updated
        await new Promise(resolve => setTimeout(resolve, 10));

        // Try to upsert with an error (should be skipped)
        const errorMapData = new MapData(
            undefined,
            undefined,
            undefined,
            undefined,
            mapDataId,
            'https://example.com/source.kml',
            'Processing failed',
        );
        const result = await upsertMapData(conn, errorMapData);

        // Should return the existing successful data, not the error data
        expect(result.id).toBe(mapDataId);
        expect(result.gpx).toBe('https://example.com/file.gpx');
        expect(result.kml).toBe('https://example.com/file.kml');
        expect(result.geoJson).toBe('https://example.com/file.geojson');
        expect(result.vectorTile).toBe('https://example.com/file.mbtiles');
        expect(result.errorMessage).toBeUndefined();

        // Verify the database still has the original successful data
        const dbRow = await db.selectOne('MapData', { id: mapDataId }).run(conn);
        expect(dbRow!.gpx).toBe('https://example.com/file.gpx');
        expect(dbRow!.errorMessage).toBeNull();

        // Verify the log message was called
        expect(consoleLogSpy).toHaveBeenCalledWith(
            `Skipping upsert for map data ${mapDataId} to avoid overwriting existing successful data with an error`
        );

        consoleLogSpy.mockRestore();
    });

    it('upserts when existing data has an error and incoming data has no error', async () => {
        const mapDataId = '11111111-1111-1111-1111-111111111111';
        
        // Insert initial record with error
        const initialMapData = new MapData(
            undefined,
            undefined,
            undefined,
            undefined,
            mapDataId,
            'https://example.com/source.kml',
            'Initial error',
        );
        await upsertMapData(conn, initialMapData);

        // Upsert with successful data (should update)
        const successMapData = new MapData(
            'https://example.com/file.gpx',
            'https://example.com/file.kml',
            'https://example.com/file.geojson',
            'https://example.com/file.mbtiles',
            mapDataId,
            'https://example.com/source.kml',
        );
        const result = await upsertMapData(conn, successMapData);

        // Should have the new successful data
        expect(result.id).toBe(mapDataId);
        expect(result.gpx).toBe('https://example.com/file.gpx');
        expect(result.kml).toBe('https://example.com/file.kml');
        expect(result.geoJson).toBe('https://example.com/file.geojson');
        expect(result.vectorTile).toBe('https://example.com/file.mbtiles');
        expect(result.errorMessage).toBeUndefined();

        // Verify the database has the updated successful data
        const dbRow = await db.selectOne('MapData', { id: mapDataId }).run(conn);
        expect(dbRow!.gpx).toBe('https://example.com/file.gpx');
        expect(dbRow!.errorMessage).toBeNull();
    });

    it('upserts when both existing and incoming data have no error', async () => {
        const mapDataId = '11111111-1111-1111-1111-111111111111';
        
        // Insert initial successful record
        const initialMapData = new MapData(
            'https://example.com/old.gpx',
            'https://example.com/old.kml',
            'https://example.com/old.geojson',
            'https://example.com/old.mbtiles',
            mapDataId,
            'https://example.com/source.kml',
        );
        await upsertMapData(conn, initialMapData);

        // Upsert with new successful data (should update)
        const updatedMapData = new MapData(
            'https://example.com/new.gpx',
            'https://example.com/new.kml',
            'https://example.com/new.geojson',
            'https://example.com/new.mbtiles',
            mapDataId,
            'https://example.com/source.kml',
        );
        const result = await upsertMapData(conn, updatedMapData);

        // Should have the updated data
        expect(result.gpx).toBe('https://example.com/new.gpx');
        expect(result.kml).toBe('https://example.com/new.kml');
        expect(result.errorMessage).toBeUndefined();
    });

    it('upserts when both existing and incoming data have errors', async () => {
        const mapDataId = '11111111-1111-1111-1111-111111111111';
        
        // Insert initial record with error
        const initialMapData = new MapData(
            undefined,
            undefined,
            undefined,
            undefined,
            mapDataId,
            'https://example.com/source.kml',
            'Initial error',
        );
        await upsertMapData(conn, initialMapData);

        // Upsert with new error (should update)
        const updatedMapData = new MapData(
            undefined,
            undefined,
            undefined,
            undefined,
            mapDataId,
            'https://example.com/source.kml',
            'New error',
        );
        const result = await upsertMapData(conn, updatedMapData);

        // Should have the new error
        expect(result.id).toBe(mapDataId);
        expect(result.errorMessage).toBe('New error');

        // Verify the database has the updated error
        const dbRow = await db.selectOne('MapData', { id: mapDataId }).run(conn);
        expect(dbRow!.errorMessage).toBe('New error');
    });

    it('upserts when there is no existing data (normal insert)', async () => {
        const mapDataId = '11111111-1111-1111-1111-111111111111';
        
        // Upsert with error when no existing data (should insert)
        const errorMapData = new MapData(
            undefined,
            undefined,
            undefined,
            undefined,
            mapDataId,
            'https://example.com/source.kml',
            'Processing failed',
        );
        const result = await upsertMapData(conn, errorMapData);

        // Should insert the data with error
        expect(result.id).toBe(mapDataId);
        expect(result.errorMessage).toBe('Processing failed');

        // Verify it was inserted
        const dbRow = await db.selectOne('MapData', { id: mapDataId }).run(conn);
        expect(dbRow).toBeDefined();
        expect(dbRow!.errorMessage).toBe('Processing failed');
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
