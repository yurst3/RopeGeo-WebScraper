import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { buildMapDataPublicUrl, buildMapDataTilesTemplate } from '../../../src/map-data/util/buildMapDataPublicUrl';

describe('buildMapDataPublicUrl', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        delete process.env.MAP_DATA_PUBLIC_BASE_URL;
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('returns S3 URL when MAP_DATA_PUBLIC_BASE_URL is not set', () => {
        const url = buildMapDataPublicUrl('my-bucket', 'source/id.kml');
        expect(url).toBe('https://my-bucket.s3.amazonaws.com/source/id.kml');
    });

    it('returns S3 URL when MAP_DATA_PUBLIC_BASE_URL is empty string', () => {
        process.env.MAP_DATA_PUBLIC_BASE_URL = '';
        const url = buildMapDataPublicUrl('my-bucket', 'geojson/id.geojson');
        expect(url).toBe('https://my-bucket.s3.amazonaws.com/geojson/id.geojson');
    });

    it('returns base URL with /mapdata/ and key when MAP_DATA_PUBLIC_BASE_URL is set', () => {
        process.env.MAP_DATA_PUBLIC_BASE_URL = 'https://api.example.com';
        const url = buildMapDataPublicUrl('my-bucket', 'source/id.kml');
        expect(url).toBe('https://api.example.com/mapdata/source/id.kml');
    });

    it('strips trailing slash from base URL before building path', () => {
        process.env.MAP_DATA_PUBLIC_BASE_URL = 'https://api.example.com/';
        const url = buildMapDataPublicUrl('my-bucket', 'geojson/id.geojson');
        expect(url).toBe('https://api.example.com/mapdata/geojson/id.geojson');
    });

    it('builds tiles directory URL when key has path segments', () => {
        process.env.MAP_DATA_PUBLIC_BASE_URL = 'https://api.webscraper.ropegeo.com';
        const url = buildMapDataPublicUrl('prod-map-bucket', 'tiles/550e8400-e29b-41d4-a716-446655440000/');
        expect(url).toBe('https://api.webscraper.ropegeo.com/mapdata/tiles/550e8400-e29b-41d4-a716-446655440000/');
    });

    it('bucket is ignored when MAP_DATA_PUBLIC_BASE_URL is set', () => {
        process.env.MAP_DATA_PUBLIC_BASE_URL = 'https://cdn.example.com';
        const url = buildMapDataPublicUrl('any-bucket', 'source/file.kml');
        expect(url).toBe('https://cdn.example.com/mapdata/source/file.kml');
        expect(url).not.toContain('any-bucket');
    });
});

describe('buildMapDataTilesTemplate', () => {
    it('appends /{z}/{x}/{y}.pbf to URL with trailing slash', () => {
        const base = 'https://api.webscraper.ropegeo.com/mapdata/tiles/3e2f61a1-5d4f-4a84-9f22-c3b4c71e1a2a/';
        expect(buildMapDataTilesTemplate(base)).toBe(
            'https://api.webscraper.ropegeo.com/mapdata/tiles/3e2f61a1-5d4f-4a84-9f22-c3b4c71e1a2a/{z}/{x}/{y}.pbf',
        );
    });

    it('appends /{z}/{x}/{y}.pbf to URL without trailing slash', () => {
        const base = 'https://api.example.com/mapdata/tiles/id';
        expect(buildMapDataTilesTemplate(base)).toBe('https://api.example.com/mapdata/tiles/id/{z}/{x}/{y}.pbf');
    });

    it('appends /{z}/{x}/{y}.pbf to local path', () => {
        const base = '/project/.savedMapData/tiles/550e8400-e29b-41d4-a716-446655440000';
        expect(buildMapDataTilesTemplate(base)).toBe('/project/.savedMapData/tiles/550e8400-e29b-41d4-a716-446655440000/{z}/{x}/{y}.pbf');
    });
});
