import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { processMapData } from '../../../src/map-data/processors/processMapData';
import MapData from '../../../src/map-data/types/mapData';
import type { SaveMapDataHookFn } from '../../../src/map-data/hook-functions/saveMapData';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { kml, gpx } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';

const execAsync = promisify(exec);

// Mock fs/promises
jest.mock('fs/promises', () => ({
    mkdtemp: jest.fn(),
    writeFile: jest.fn(),
    rm: jest.fn(),
}));

// Mock child_process.exec
jest.mock('child_process', () => ({
    exec: jest.fn(),
}));

// Mock crypto.randomUUID
const mockRandomUUID = jest.fn();
jest.mock('crypto', () => ({
    randomUUID: () => mockRandomUUID(),
}));

// Mock @tmcw/togeojson
const mockKml = jest.fn();
const mockGpx = jest.fn();
jest.mock('@tmcw/togeojson', () => ({
    kml: (dom: any) => mockKml(dom),
    gpx: (dom: any) => mockGpx(dom),
}));

// Mock @xmldom/xmldom
const mockParseFromString = jest.fn<(text: string, mimeType: string) => any>();
jest.mock('@xmldom/xmldom', () => ({
    DOMParser: jest.fn(() => ({
        parseFromString: mockParseFromString,
    })),
}));

// Mock global fetch
const mockFetch = jest.fn<typeof fetch>();
global.fetch = mockFetch as typeof fetch;

describe('processMapData', () => {
    const mockMapDataId = '11111111-1111-1111-1111-111111111111';
    const mockTempDir = '/tmp/map-data-abc123';
    const mockSourceFilePath = join(mockTempDir, `${mockMapDataId}.kml`);
    const mockGeoJsonFilePath = join(mockTempDir, `${mockMapDataId}.geojson`);
    const mockVectorTileFilePath = join(mockTempDir, `${mockMapDataId}.mbtiles`);
    
    const mockSourceFileContent = '<?xml version="1.0"?><kml></kml>';
    const mockGeoJson = { type: 'FeatureCollection', features: [] };
    const mockDom = { mock: 'dom' };
    
    let mockSaveMapDataHookFn: jest.MockedFunction<SaveMapDataHookFn>;
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        jest.clearAllMocks();
        originalEnv = process.env;

        // Setup default mocks
        (mkdtemp as jest.MockedFunction<typeof mkdtemp>).mockResolvedValue(mockTempDir);
        (writeFile as jest.MockedFunction<typeof writeFile>).mockResolvedValue(undefined);
        (rm as jest.MockedFunction<typeof rm>).mockResolvedValue(undefined);
        mockRandomUUID.mockReturnValue(mockMapDataId);
        
        // Mock fetch
        const mockText = jest.fn<() => Promise<string>>().mockResolvedValue(mockSourceFileContent);
        mockFetch.mockResolvedValue({
            ok: true,
            text: mockText,
        } as unknown as Response);

        // Mock XML parsing
        mockParseFromString.mockReturnValue(mockDom as any);

        // Mock GeoJSON conversion
        mockKml.mockReturnValue(mockGeoJson);
        mockGpx.mockReturnValue(mockGeoJson);

        // Mock exec (tippecanoe) - mock it properly for promisify
        (exec as jest.MockedFunction<typeof exec>).mockImplementation(
            ((command: string, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
                if (callback) {
                    callback(null, '', '');
                }
                return {} as any;
            }) as typeof exec
        );

        // Mock save hook function
        mockSaveMapDataHookFn = jest.fn<SaveMapDataHookFn>().mockResolvedValue({
            sourceFile: 'https://s3.amazonaws.com/bucket/source/file.kml',
            geoJsonFile: 'https://s3.amazonaws.com/bucket/geojson/file.geojson',
            vectorTileFile: 'https://s3.amazonaws.com/bucket/vector-tiles/file.mbtiles',
        });
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('signature', () => {
        it('requires saveMapDataHookFn parameter', () => {
            type Args = Parameters<typeof processMapData>;

            // @ts-expect-error saveMapDataHookFn is required
            const _badArgs: Args = ['https://example.com/file.kml'];

            const _goodArgs: Args = [
                'https://example.com/file.kml',
                async () => ({
                    sourceFile: 'local://source',
                    geoJsonFile: 'local://geojson',
                    vectorTileFile: 'local://mbtiles',
                }),
            ];

            expect(Array.isArray(_goodArgs)).toBe(true);
        });
    });

    describe('KML file processing', () => {
        it('successfully processes a KML file and returns MapData', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';

            const result = await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            expect(result).toBeInstanceOf(MapData);
            expect(result.id).toBe(mockMapDataId);
            expect(result.kml).toBe('https://s3.amazonaws.com/bucket/source/file.kml');
            expect(result.gpx).toBeUndefined();
            expect(result.geoJson).toBe('https://s3.amazonaws.com/bucket/geojson/file.geojson');
            expect(result.vectorTile).toBe('https://s3.amazonaws.com/bucket/vector-tiles/file.mbtiles');
        });

        it('calls saveMapDataHookFn with correct parameters for KML', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';

            await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            expect(mockSaveMapDataHookFn).toHaveBeenCalledTimes(1);
            expect(mockSaveMapDataHookFn).toHaveBeenCalledWith(
                mockSourceFilePath,
                mockGeoJsonFilePath,
                mockVectorTileFilePath,
                mockMapDataId,
                true, // isKml
            );
        });

        it('downloads KML file and writes it to temp directory', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';

            await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            expect(mockFetch).toHaveBeenCalledWith(sourceFileUrl);
            expect(writeFile).toHaveBeenCalledWith(mockSourceFilePath, mockSourceFileContent, 'utf-8');
        });

        it('converts KML to GeoJSON using kml parser', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';

            await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            expect(mockParseFromString).toHaveBeenCalledWith(mockSourceFileContent, 'text/xml');
            expect(mockKml).toHaveBeenCalledWith(mockDom);
            expect(mockGpx).not.toHaveBeenCalled();
            expect(writeFile).toHaveBeenCalledWith(
                mockGeoJsonFilePath,
                JSON.stringify(mockGeoJson),
                'utf-8',
            );
        });
    });

    describe('GPX file processing', () => {
        it('successfully processes a GPX file and returns MapData', async () => {
            const sourceFileUrl = 'https://example.com/test.gpx';

            const result = await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            expect(result).toBeInstanceOf(MapData);
            expect(result.id).toBe(mockMapDataId);
            expect(result.gpx).toBe('https://s3.amazonaws.com/bucket/source/file.kml');
            expect(result.kml).toBeUndefined();
            expect(result.geoJson).toBe('https://s3.amazonaws.com/bucket/geojson/file.geojson');
            expect(result.vectorTile).toBe('https://s3.amazonaws.com/bucket/vector-tiles/file.mbtiles');
        });

        it('calls saveMapDataHookFn with correct parameters for GPX', async () => {
            const sourceFileUrl = 'https://example.com/test.gpx';
            const expectedSourceFilePath = join(mockTempDir, `${mockMapDataId}.gpx`);

            await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            expect(mockSaveMapDataHookFn).toHaveBeenCalledTimes(1);
            expect(mockSaveMapDataHookFn).toHaveBeenCalledWith(
                expectedSourceFilePath,
                mockGeoJsonFilePath,
                mockVectorTileFilePath,
                mockMapDataId,
                false, // isKml
            );
        });

        it('converts GPX to GeoJSON using gpx parser', async () => {
            const sourceFileUrl = 'https://example.com/test.gpx';

            await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            expect(mockParseFromString).toHaveBeenCalledWith(mockSourceFileContent, 'text/xml');
            expect(mockGpx).toHaveBeenCalledWith(mockDom);
            expect(mockKml).not.toHaveBeenCalled();
        });
    });

    describe('mapDataId handling', () => {
        it('generates a new UUID when mapDataId is not provided', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            const generatedId = '22222222-2222-2222-2222-222222222222';
            mockRandomUUID.mockReturnValueOnce(generatedId);

            const result = await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            expect(result.id).toBe(generatedId);
            expect(mockRandomUUID).toHaveBeenCalled();
            expect(mockSaveMapDataHookFn).toHaveBeenCalledWith(
                expect.stringContaining(generatedId),
                expect.stringContaining(generatedId),
                expect.stringContaining(generatedId),
                generatedId,
                true,
            );
        });

        it('uses provided mapDataId', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            const providedId = '33333333-3333-3333-3333-333333333333';

            const result = await processMapData(sourceFileUrl, mockSaveMapDataHookFn, providedId);

            expect(result.id).toBe(providedId);
            expect(mockRandomUUID).not.toHaveBeenCalled();
            expect(mockSaveMapDataHookFn).toHaveBeenCalledWith(
                expect.stringContaining(providedId),
                expect.stringContaining(providedId),
                expect.stringContaining(providedId),
                providedId,
                true,
            );
        });

        it('generates new UUID when mapDataId is null', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            const generatedId = '44444444-4444-4444-4444-444444444444';
            mockRandomUUID.mockReturnValueOnce(generatedId);

            const result = await processMapData(sourceFileUrl, mockSaveMapDataHookFn, null);

            expect(result.id).toBe(generatedId);
            expect(mockRandomUUID).toHaveBeenCalled();
        });
    });

    describe('tippecanoe integration', () => {
        it('runs tippecanoe command to convert GeoJSON to vector tiles', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            const expectedCommand = `tippecanoe -o "${mockVectorTileFilePath}" "${mockGeoJsonFilePath}"`;

            await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            expect(exec).toHaveBeenCalledWith(
                expectedCommand,
                expect.any(Function),
            );
        });

        it('uses Lambda path for tippecanoe when LAMBDA_TASK_ROOT is set', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            process.env.LAMBDA_TASK_ROOT = '/var/task';
            const { join: pathJoin } = await import('path');
            const expectedCommand = `${pathJoin('/var/task', 'tippecanoe')} -o "${mockVectorTileFilePath}" "${mockGeoJsonFilePath}"`;

            await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            expect(exec).toHaveBeenCalledWith(
                expectedCommand,
                expect.any(Function),
            );
        });

        it('handles tippecanoe errors', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            const tippecanoeError = new Error('Tippecanoe failed');
            (exec as jest.MockedFunction<typeof exec>).mockImplementation(
                ((command: string, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
                    if (callback) {
                        callback(tippecanoeError, '', 'error');
                    }
                    return {} as any;
                }) as typeof exec
            );

            await expect(
                processMapData(sourceFileUrl, mockSaveMapDataHookFn),
            ).rejects.toThrow('Tippecanoe failed');
        });
    });

    describe('error handling', () => {
        it('throws error for unsupported file types', async () => {
            const sourceFileUrl = 'https://example.com/test.xml';

            await expect(
                processMapData(sourceFileUrl, mockSaveMapDataHookFn),
            ).rejects.toThrow('Unsupported file type. Expected .kml or .gpx, got: https://example.com/test.xml');
        });

        it('throws error when fetch fails', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            mockFetch.mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found',
            } as Response);

            await expect(
                processMapData(sourceFileUrl, mockSaveMapDataHookFn),
            ).rejects.toThrow('Failed to download source file: 404 Not Found');
        });

        it('throws error when fetch throws', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            const fetchError = new Error('Network error');
            mockFetch.mockRejectedValue(fetchError);

            await expect(
                processMapData(sourceFileUrl, mockSaveMapDataHookFn),
            ).rejects.toThrow('Network error');
        });

        it('throws error when saveMapDataHookFn fails', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            const hookError = new Error('Failed to save files');
            mockSaveMapDataHookFn.mockRejectedValue(hookError);

            await expect(
                processMapData(sourceFileUrl, mockSaveMapDataHookFn),
            ).rejects.toThrow('Failed to save files');
        });
    });

    describe('temp directory cleanup', () => {
        it('creates a temporary directory', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';

            await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            expect(mkdtemp).toHaveBeenCalledWith(
                expect.stringContaining(join(tmpdir(), 'map-data-')),
            );
        });

        it('cleans up temp directory after successful processing', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';

            await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            expect(rm).toHaveBeenCalledWith(mockTempDir, {
                recursive: true,
                force: true,
            });
        });

        it('cleans up temp directory even when an error occurs', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            const hookError = new Error('Failed to save files');
            mockSaveMapDataHookFn.mockRejectedValue(hookError);

            await expect(
                processMapData(sourceFileUrl, mockSaveMapDataHookFn),
            ).rejects.toThrow('Failed to save files');

            expect(rm).toHaveBeenCalledWith(mockTempDir, {
                recursive: true,
                force: true,
            });
        });
    });

    describe('case insensitive file extension detection', () => {
        it('handles uppercase KML extension', async () => {
            const sourceFileUrl = 'https://example.com/test.KML';

            const result = await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            expect(result.kml).toBeDefined();
            expect(result.gpx).toBeUndefined();
            expect(mockSaveMapDataHookFn).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                expect.any(String),
                expect.any(String),
                true, // isKml
            );
        });

        it('handles uppercase GPX extension', async () => {
            const sourceFileUrl = 'https://example.com/test.GPX';

            const result = await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            expect(result.gpx).toBeDefined();
            expect(result.kml).toBeUndefined();
            expect(mockSaveMapDataHookFn).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                expect.any(String),
                expect.any(String),
                false, // isKml
            );
        });
    });
});

