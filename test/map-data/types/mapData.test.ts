import { describe, it, expect } from '@jest/globals';
import { Bounds } from 'ropegeo-common/models';
import MapData from '../../../src/map-data/types/mapData';

// Type definitions matching zapatos schema for testing
type MapDataJSONSelectable = {
    id: string;
    gpx: string | null;
    kml: string | null;
    geoJson: string | null;
    tilesTemplate: string | null;
    bounds: object | null;
    deletedAt: string | null; // Always null in database, but present in schema
    createdAt: string;
    updatedAt: string;
};

describe('MapData', () => {
    describe('constructor', () => {
        it('creates MapData with all properties', () => {
            const id = '11111111-1111-1111-1111-111111111111';
            const gpx = 'https://example.com/file.gpx';
            const kml = 'https://example.com/file.kml';
            const geoJson = 'https://example.com/file.geojson';
            const tilesTemplate = 'https://example.com/file.mbtiles';

            const mapData = new MapData(gpx, kml, geoJson, tilesTemplate, id);

            expect(mapData.id).toBe(id);
            expect(mapData.gpx).toBe(gpx);
            expect(mapData.kml).toBe(kml);
            expect(mapData.geoJson).toBe(geoJson);
            expect(mapData.tilesTemplate).toBe(tilesTemplate);
        });

        it('creates MapData with no parameters', () => {
            const mapData = new MapData();

            expect(mapData.id).toBeUndefined();
            expect(mapData.gpx).toBeUndefined();
            expect(mapData.kml).toBeUndefined();
            expect(mapData.geoJson).toBeUndefined();
            expect(mapData.tilesTemplate).toBeUndefined();
        });

        it('creates MapData with only gpx', () => {
            const gpx = 'https://example.com/file.gpx';
            const mapData = new MapData(gpx);

            expect(mapData.gpx).toBe(gpx);
            expect(mapData.kml).toBeUndefined();
            expect(mapData.geoJson).toBeUndefined();
            expect(mapData.tilesTemplate).toBeUndefined();
        });

        it('creates MapData with only kml', () => {
            const kml = 'https://example.com/file.kml';
            const mapData = new MapData(undefined, kml);

            expect(mapData.gpx).toBeUndefined();
            expect(mapData.kml).toBe(kml);
        });

        it('creates MapData with only geoJson', () => {
            const geoJson = 'https://example.com/file.geojson';
            const mapData = new MapData(undefined, undefined, geoJson);

            expect(mapData.geoJson).toBe(geoJson);
        });

        it('creates MapData with only tilesTemplate', () => {
            const tilesTemplate = 'https://example.com/file.mbtiles';
            const mapData = new MapData(undefined, undefined, undefined, tilesTemplate);

            expect(mapData.tilesTemplate).toBe(tilesTemplate);
        });

        it('creates MapData with id only', () => {
            const id = '22222222-2222-2222-2222-222222222222';
            const mapData = new MapData(undefined, undefined, undefined, undefined, id);

            expect(mapData.id).toBe(id);
        });

    });

    describe('toDbRow', () => {
        it('converts MapData to database row with all fields', () => {
            const id = '11111111-1111-1111-1111-111111111111';
            const gpx = 'https://example.com/file.gpx';
            const kml = 'https://example.com/file.kml';
            const geoJson = 'https://example.com/file.geojson';
            const tilesTemplate = 'https://example.com/file.mbtiles';

            const mapData = new MapData(gpx, kml, geoJson, tilesTemplate, id);
            const dbRow = mapData.toDbRow();

            expect(dbRow.id).toBe(id);
            expect(dbRow.gpx).toBe(gpx);
            expect(dbRow.kml).toBe(kml);
            expect(dbRow.geoJson).toBe(geoJson);
            expect(dbRow.tilesTemplate).toBe(tilesTemplate);
            expect(dbRow.deletedAt).toBeNull();
            expect(dbRow.updatedAt).toBeInstanceOf(Date);
        });

        it('converts MapData without id to database row', () => {
            const gpx = 'https://example.com/file.gpx';
            const mapData = new MapData(gpx);
            const dbRow = mapData.toDbRow();

            expect(dbRow.id).toBeUndefined();
            expect(dbRow.gpx).toBe(gpx);
            expect(dbRow.updatedAt).toBeInstanceOf(Date);
        });

        it('converts undefined values to null in database row', () => {
            const mapData = new MapData();
            const dbRow = mapData.toDbRow();

            expect(dbRow.gpx).toBeNull();
            expect(dbRow.kml).toBeNull();
            expect(dbRow.geoJson).toBeNull();
            expect(dbRow.tilesTemplate).toBeNull();
            expect(dbRow.bounds).toBeNull();
            expect(dbRow.deletedAt).toBeNull(); // Always null
            expect(dbRow.updatedAt).toBeInstanceOf(Date);
        });

        it('converts partial MapData to database row', () => {
            const gpx = 'https://example.com/file.gpx';
            const geoJson = 'https://example.com/file.geojson';
            const mapData = new MapData(gpx, undefined, geoJson);
            const dbRow = mapData.toDbRow();

            expect(dbRow.gpx).toBe(gpx);
            expect(dbRow.kml).toBeNull();
            expect(dbRow.geoJson).toBe(geoJson);
            expect(dbRow.tilesTemplate).toBeNull();
        });

        it('includes id when provided', () => {
            const id = '33333333-3333-3333-3333-333333333333';
            const mapData = new MapData(undefined, undefined, undefined, undefined, id);
            const dbRow = mapData.toDbRow();

            expect(dbRow.id).toBe(id);
        });

        it('excludes id when not provided', () => {
            const mapData = new MapData();
            const dbRow = mapData.toDbRow();

            expect(dbRow.id).toBeUndefined();
        });

        it('includes bounds in database row when set via setBounds', () => {
            const mapData = new MapData();
            const bounds = new Bounds(45, 40, -70, -75);
            mapData.setBounds(bounds);
            const dbRow = mapData.toDbRow();

            expect(dbRow.bounds).toEqual({ north: 45, south: 40, east: -70, west: -75 });
        });

        it('sets updatedAt to current time', () => {
            const before = new Date();
            const mapData = new MapData();
            const dbRow = mapData.toDbRow();
            const after = new Date();

            expect(dbRow.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
            expect(dbRow.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
        });
    });

    describe('fromDbRow', () => {
        it('creates MapData from database row with all fields', () => {
            const id = '11111111-1111-1111-1111-111111111111';
            const gpx = 'https://example.com/file.gpx';
            const kml = 'https://example.com/file.kml';
            const geoJson = 'https://example.com/file.geojson';
            const tiles = 'https://example.com/file.mbtiles';

            const dbRow: MapDataJSONSelectable = {
                id,
                gpx,
                kml,
                geoJson,
                tilesTemplate: tiles,
                deletedAt: null, // Always null
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const mapData = MapData.fromDbRow(dbRow);

            expect(mapData.id).toBe(id);
            expect(mapData.gpx).toBe(gpx);
            expect(mapData.kml).toBe(kml);
            expect(mapData.geoJson).toBe(geoJson);
            expect(mapData.tilesTemplate).toBe(tiles);
        });

        it('creates MapData from database row with null values', () => {
            const id = '22222222-2222-2222-2222-222222222222';

            const dbRow: MapDataJSONSelectable = {
                id,
                gpx: null,
                kml: null,
                geoJson: null,
                tilesTemplate: null,
                deletedAt: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const mapData = MapData.fromDbRow(dbRow);

            expect(mapData.id).toBe(id);
            expect(mapData.gpx).toBeUndefined();
            expect(mapData.kml).toBeUndefined();
            expect(mapData.geoJson).toBeUndefined();
            expect(mapData.tilesTemplate).toBeUndefined();
        });

        it('creates MapData from database row with partial fields', () => {
            const id = '33333333-3333-3333-3333-333333333333';
            const gpx = 'https://example.com/file.gpx';
            const geoJson = 'https://example.com/file.geojson';

            const dbRow: MapDataJSONSelectable = {
                id,
                gpx,
                kml: null,
                geoJson,
                tilesTemplate: null,
                deletedAt: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const mapData = MapData.fromDbRow(dbRow);

            expect(mapData.gpx).toBe(gpx);
            expect(mapData.kml).toBeUndefined();
            expect(mapData.geoJson).toBe(geoJson);
            expect(mapData.tilesTemplate).toBeUndefined();
        });

    });

    describe('round-trip conversion', () => {
        it('can convert toDbRow and fromDbRow back to original (with id)', () => {
            const id = '66666666-6666-6666-6666-666666666666';
            const gpx = 'https://example.com/file.gpx';
            const kml = 'https://example.com/file.kml';
            const geoJson = 'https://example.com/file.geojson';
            const tiles = 'https://example.com/file.mbtiles';

            const original = new MapData(gpx, kml, geoJson, tiles, id);
            const dbRow = original.toDbRow();

            // Create a JSONSelectable from Insertable (simulating what database returns)
            const jsonRow: MapDataJSONSelectable = {
                id: dbRow.id!,
                gpx: dbRow.gpx ?? null,
                kml: dbRow.kml ?? null,
                geoJson: dbRow.geoJson ?? null,
                tilesTemplate: dbRow.tilesTemplate ?? null,
                bounds: dbRow.bounds ?? null,
                deletedAt: null, // Always null
                createdAt: new Date().toISOString(),
                updatedAt: (dbRow.updatedAt as Date).toISOString(),
            };

            const restored = MapData.fromDbRow(jsonRow);

            expect(restored.id).toBe(original.id);
            expect(restored.gpx).toBe(original.gpx);
            expect(restored.kml).toBe(original.kml);
            expect(restored.geoJson).toBe(original.geoJson);
            expect(restored.tilesTemplate).toBe(original.tilesTemplate);
        });

        it('can convert toDbRow and fromDbRow back to original (without id)', () => {
            const gpx = 'https://example.com/file.gpx';
            const kml = 'https://example.com/file.kml';

            const original = new MapData(gpx, kml);
            const dbRow = original.toDbRow();

            // Simulate database generating an id
            const generatedId = '77777777-7777-7777-7777-777777777777';
            const jsonRow: MapDataJSONSelectable = {
                id: generatedId,
                gpx: dbRow.gpx ?? null,
                kml: dbRow.kml ?? null,
                geoJson: dbRow.geoJson ?? null,
                tilesTemplate: dbRow.tilesTemplate ?? null,
                bounds: dbRow.bounds ?? null,
                deletedAt: null, // Always null
                createdAt: new Date().toISOString(),
                updatedAt: (dbRow.updatedAt as Date).toISOString(),
            };

            const restored = MapData.fromDbRow(jsonRow);

            expect(restored.gpx).toBe(original.gpx);
            expect(restored.kml).toBe(original.kml);
            expect(restored.geoJson).toBe(original.geoJson);
            expect(restored.tilesTemplate).toBe(original.tilesTemplate);
        });

        it('round-trips bounds via setBounds, toDbRow, and fromDbRow', () => {
            const id = '88888888-8888-8888-8888-888888888888';
            const original = new MapData(undefined, undefined, undefined, undefined, id);
            const bounds = new Bounds(50, 49, -122, -123);
            original.setBounds(bounds);
            const dbRow = original.toDbRow();
            const jsonRow: MapDataJSONSelectable = {
                id: dbRow.id ?? id,
                gpx: dbRow.gpx ?? null,
                kml: dbRow.kml ?? null,
                geoJson: dbRow.geoJson ?? null,
                tilesTemplate: dbRow.tilesTemplate ?? null,
                bounds: dbRow.bounds ?? null,
                deletedAt: null,
                createdAt: new Date().toISOString(),
                updatedAt: (dbRow.updatedAt as Date).toISOString(),
            };
            const restored = MapData.fromDbRow(jsonRow);
            expect(restored.bounds).not.toBeNull();
            expect(restored.bounds!.north).toBe(50);
            expect(restored.bounds!.south).toBe(49);
            expect(restored.bounds!.east).toBe(-122);
            expect(restored.bounds!.west).toBe(-123);
        });
    });
});
