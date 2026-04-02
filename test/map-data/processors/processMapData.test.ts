import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { processMapData } from '../../../src/map-data/processors/processMapData';
import MapData from '../../../src/map-data/types/mapData';
import type { SaveMapDataHookFn } from '../../../src/map-data/hook-functions/saveMapData';
import { ProgressLogger } from 'ropegeo-common/helpers';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

// Mock fs/promises
jest.mock('fs/promises', () => ({
    mkdtemp: jest.fn(),
    rm: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn().mockResolvedValue(undefined),
}));

// Mock crypto.randomUUID
const mockRandomUUID = jest.fn();
jest.mock('crypto', () => ({
    randomUUID: () => mockRandomUUID(),
}));

// Mock utility functions
jest.mock('../../../src/map-data/http/downloadSourceFile', () => ({
    downloadSourceFile: jest.fn(),
}));

jest.mock('../../../src/map-data/s3/getSourceFile', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../src/map-data/util/convertToGeoJson', () => ({
    convertToGeoJson: jest.fn(),
}));

jest.mock('../../../src/map-data/util/convertToTileDirectory', () => ({
    convertToTileDirectory: jest.fn(),
}));

jest.mock('ropegeo-common/helpers', () => ({
    __esModule: true,
    ProgressLogger: jest.fn().mockImplementation(() => ({
        setChunk: jest.fn(),
        logProgress: jest.fn(),
        logError: jest.fn(),
        getResults: jest.fn(),
    })),
}));

describe('processMapData', () => {
    const mockMapDataId = '11111111-1111-1111-1111-111111111111';
    const mockTempDir = '/tmp/map-data-abc123';
    const mockSourceFilePath = join(mockTempDir, `${mockMapDataId}.kml`);
    const mockGeoJsonFilePath = join(mockTempDir, `${mockMapDataId}.geojson`);
    const mockTilesDirPath = join(mockTempDir, 'tiles');
    const mockTilesUrl = `https://api.example.com/mapdata/tiles/${mockMapDataId}/`;

    const mockSourceFileContent = '<?xml version="1.0"?><kml></kml>';
    let mockSaveMapDataHookFn: jest.MockedFunction<SaveMapDataHookFn>;
    let mockLogger: any;
    let originalEnv: NodeJS.ProcessEnv;

    let mockDownloadSourceFile: jest.MockedFunction<any>;
    let mockGetSourceFile: jest.MockedFunction<any>;
    let mockConvertToGeoJson: jest.MockedFunction<any>;
    let mockConvertToTileDirectory: jest.MockedFunction<any>;

    beforeEach(() => {
        jest.clearAllMocks();
        originalEnv = process.env;
        mockLogger = new ProgressLogger('Test', 1);

        // Setup default mocks
        (mkdtemp as jest.MockedFunction<typeof mkdtemp>).mockResolvedValue(mockTempDir);
        (rm as jest.MockedFunction<typeof rm>).mockResolvedValue(undefined);
        mockRandomUUID.mockReturnValue(mockMapDataId);
        
        process.env.DEV_ENVIRONMENT = 'testing';
        process.env.MAP_DATA_BUCKET_NAME = 'bucket';
        process.env.MAP_DATA_PUBLIC_BASE_URL = 'https://api.example.com';

        const downloadSourceFileModule = require('../../../src/map-data/http/downloadSourceFile');
        const getSourceFileModule = require('../../../src/map-data/s3/getSourceFile');
        const convertToGeoJsonModule = require('../../../src/map-data/util/convertToGeoJson');
        const convertToTileDirectoryModule = require('../../../src/map-data/util/convertToTileDirectory');

        mockDownloadSourceFile = downloadSourceFileModule.downloadSourceFile;
        mockGetSourceFile = getSourceFileModule.default;
        mockConvertToGeoJson = convertToGeoJsonModule.convertToGeoJson;
        mockConvertToTileDirectory = convertToTileDirectoryModule.convertToTileDirectory;

        mockDownloadSourceFile.mockReset();
        mockGetSourceFile.mockReset();
        mockConvertToGeoJson.mockReset();
        mockConvertToTileDirectory.mockReset();
        
        // Mock utility functions with successful responses
        // Use mockImplementation to construct file path based on isKml parameter
        mockDownloadSourceFile.mockImplementation(
            async (sourceFileUrl: string, tempDir: string, mapDataId: string, isKml: boolean, _abortSignal?: AbortSignal) => {
                const fileExtension = isKml ? 'kml' : 'gpx';
                const filePath = join(tempDir, `${mapDataId}.${fileExtension}`);
                return {
                    filePath,
                    content: mockSourceFileContent,
                };
            }
        );

        // Use mockImplementation to construct file paths based on mapDataId parameter
        mockConvertToGeoJson.mockImplementation(
            async (sourceFileContent: string, tempDir: string, mapDataId: string, isKml: boolean) => {
                const filePath = join(tempDir, `${mapDataId}.geojson`);
                return {
                    filePath,
                    error: undefined,
                };
            }
        );

        mockConvertToTileDirectory.mockImplementation(
            async (_geoJsonFilePath: string, outputDir: string, _mapDataId: string) => ({
                tilesDir: outputDir,
            })
        );

        mockSaveMapDataHookFn = jest.fn<SaveMapDataHookFn>().mockImplementation(
            async (
                sourceFilePath,
                geoJsonFilePath,
                _tilesDirPath,
                mapDataId,
                isKml,
                sourceFileUrl,
                errorMessage,
            ) => {
                const sourceFile = sourceFilePath
                    ? `https://s3.amazonaws.com/bucket/source/${mapDataId}.${isKml ? 'kml' : 'gpx'}`
                    : undefined;
                const geoJsonFile = geoJsonFilePath
                    ? `https://s3.amazonaws.com/bucket/geojson/${mapDataId}.geojson`
                    : undefined;
                const tilesUrl = `https://api.example.com/mapdata/tiles/${mapDataId}/`;
                return new MapData(
                    isKml ? undefined : sourceFile,
                    isKml ? sourceFile : undefined,
                    geoJsonFile,
                    tilesUrl,
                    mapDataId,
                    sourceFileUrl,
                    errorMessage,
                );
            }
        );
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
                async () => new MapData(
                    undefined,
                    'local://source',
                    'local://geojson',
                    'https://api.example.com/mapdata/tiles/test-id/',
                    'test-id',
                    'https://example.com/file.kml',
                    undefined,
                ),
            ];

            expect(Array.isArray(_goodArgs)).toBe(true);
        });
    });

    describe('KML file processing', () => {
        it('successfully processes a KML file and returns MapData', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';

            const result = await processMapData(sourceFileUrl, mockSaveMapDataHookFn, undefined, mockLogger);

            expect(result).toBeInstanceOf(MapData);
            expect(result.id).toBe(mockMapDataId);
            expect(result.kml).toBe(`https://s3.amazonaws.com/bucket/source/${mockMapDataId}.kml`);
            expect(result.gpx).toBeUndefined();
            expect(result.geoJson).toBe(`https://s3.amazonaws.com/bucket/geojson/${mockMapDataId}.geojson`);
            expect(result.tilesTemplate).toBe(mockTilesUrl);
            expect(result.sourceFileUrl).toBe(sourceFileUrl);
            expect(result.errorMessage).toBeUndefined();
        });

        it('calls saveMapDataHookFn with correct parameters for KML', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';

            await processMapData(sourceFileUrl, mockSaveMapDataHookFn, undefined, mockLogger);

            expect(mockSaveMapDataHookFn).toHaveBeenCalledTimes(1);
            expect(mockSaveMapDataHookFn).toHaveBeenCalledWith(
                mockSourceFilePath,
                mockGeoJsonFilePath,
                mockTilesDirPath,
                mockMapDataId,
                true,
                sourceFileUrl,
                undefined,
                mockLogger,
            );
        });

        it('calls downloadSourceFile with correct parameters', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';

            await processMapData(sourceFileUrl, mockSaveMapDataHookFn, undefined, mockLogger);

            expect(mockDownloadSourceFile).toHaveBeenCalledTimes(1);
            expect(mockDownloadSourceFile).toHaveBeenCalledWith(
                sourceFileUrl,
                mockTempDir,
                mockMapDataId,
                true, // isKml
                undefined,
            );
        });

        it('passes abortSignal through to downloadSourceFile when provided', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            const abortSignal = new AbortController().signal;

            await processMapData(sourceFileUrl, mockSaveMapDataHookFn, undefined, mockLogger, abortSignal);

            expect(mockDownloadSourceFile).toHaveBeenCalledWith(
                sourceFileUrl,
                mockTempDir,
                mockMapDataId,
                true,
                abortSignal,
            );
        });

        it('does not call saveMapDataHookFn when abortSignal is aborted after conversion steps', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            const controller = new AbortController();
            mockConvertToTileDirectory.mockImplementation(async () => {
                controller.abort(new Error('Timed out'));
                return { tilesDir: join(mockTempDir, 'tiles') };
            });

            await expect(
                processMapData(sourceFileUrl, mockSaveMapDataHookFn, undefined, mockLogger, controller.signal),
            ).rejects.toThrow('Timed out');

            expect(mockSaveMapDataHookFn).not.toHaveBeenCalled();
        });

        it('calls convertToGeoJson with correct parameters', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';

            await processMapData(sourceFileUrl, mockSaveMapDataHookFn, undefined, mockLogger);

            expect(mockConvertToGeoJson).toHaveBeenCalledTimes(1);
            expect(mockConvertToGeoJson).toHaveBeenCalledWith(
                mockSourceFileContent,
                mockTempDir,
                mockMapDataId,
                true, // isKml
            );
        });

        it('calls convertToTileDirectory with correct parameters', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';

            await processMapData(sourceFileUrl, mockSaveMapDataHookFn, undefined, mockLogger);

            expect(mockConvertToTileDirectory).toHaveBeenCalledTimes(1);
            expect(mockConvertToTileDirectory).toHaveBeenCalledWith(
                mockGeoJsonFilePath,
                join(mockTempDir, 'tiles'),
                mockMapDataId,
            );
        });
    });

    describe('GPX file processing', () => {
        it('successfully processes a GPX file and returns MapData', async () => {
            const sourceFileUrl = 'https://example.com/test.gpx';

            const result = await processMapData(sourceFileUrl, mockSaveMapDataHookFn, undefined, mockLogger);

            expect(result).toBeInstanceOf(MapData);
            expect(result.id).toBe(mockMapDataId);
            expect(result.gpx).toBe(`https://s3.amazonaws.com/bucket/source/${mockMapDataId}.gpx`);
            expect(result.kml).toBeUndefined();
            expect(result.geoJson).toBe(`https://s3.amazonaws.com/bucket/geojson/${mockMapDataId}.geojson`);
            expect(result.tilesTemplate).toBe(mockTilesUrl);
        });

        it('calls saveMapDataHookFn with correct parameters for GPX', async () => {
            const sourceFileUrl = 'https://example.com/test.gpx';
            const expectedSourceFilePath = join(mockTempDir, `${mockMapDataId}.gpx`);

            await processMapData(sourceFileUrl, mockSaveMapDataHookFn, undefined, mockLogger);

            expect(mockSaveMapDataHookFn).toHaveBeenCalledTimes(1);
            expect(mockSaveMapDataHookFn).toHaveBeenCalledWith(
                expectedSourceFilePath,
                mockGeoJsonFilePath,
                mockTilesDirPath,
                mockMapDataId,
                false,
                sourceFileUrl,
                undefined,
                mockLogger,
            );
        });

        it('calls downloadSourceFile with isKml=false for GPX', async () => {
            const sourceFileUrl = 'https://example.com/test.gpx';
            const expectedSourceFilePath = join(mockTempDir, `${mockMapDataId}.gpx`);
            mockDownloadSourceFile.mockResolvedValueOnce({
                filePath: expectedSourceFilePath,
                content: mockSourceFileContent,
            });

            await processMapData(sourceFileUrl, mockSaveMapDataHookFn, undefined, mockLogger);

            expect(mockDownloadSourceFile).toHaveBeenCalledWith(
                sourceFileUrl,
                mockTempDir,
                mockMapDataId,
                false, // isKml
                undefined,
            );
            expect(mockConvertToGeoJson).toHaveBeenCalledWith(
                mockSourceFileContent,
                mockTempDir,
                mockMapDataId,
                false, // isKml
            );
        });
    });

    describe('mapDataId handling', () => {
        it('generates a new UUID when mapDataId is not provided', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            const generatedId = '22222222-2222-2222-2222-222222222222';
            mockRandomUUID.mockReturnValueOnce(generatedId);

            const result = await processMapData(sourceFileUrl, mockSaveMapDataHookFn, undefined, mockLogger);

            expect(result.id).toBe(generatedId);
            expect(mockRandomUUID).toHaveBeenCalled();
            expect(mockSaveMapDataHookFn).toHaveBeenCalledWith(
                expect.stringContaining(generatedId),
                expect.stringContaining(generatedId),
                expect.stringContaining('tiles'),
                generatedId,
                true,
                sourceFileUrl,
                undefined,
                mockLogger,
            );
        });

        it('uses provided mapDataId', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            const providedId = '33333333-3333-3333-3333-333333333333';

            const result = await processMapData(sourceFileUrl, mockSaveMapDataHookFn, providedId, mockLogger);

            expect(result.id).toBe(providedId);
            expect(mockRandomUUID).not.toHaveBeenCalled();
            expect(mockSaveMapDataHookFn).toHaveBeenCalledWith(
                expect.stringContaining(providedId),
                expect.stringContaining(providedId),
                expect.stringContaining('tiles'),
                providedId,
                true,
                sourceFileUrl,
                undefined,
                mockLogger,
            );
        });

        it('generates new UUID when mapDataId is null', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            const generatedId = '44444444-4444-4444-4444-444444444444';
            mockRandomUUID.mockReturnValueOnce(generatedId);

            const result = await processMapData(sourceFileUrl, mockSaveMapDataHookFn, null, mockLogger);

            expect(result.id).toBe(generatedId);
            expect(mockRandomUUID).toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        it('returns MapData with error message for unsupported file types', async () => {
            const sourceFileUrl = 'https://example.com/test.xml';

            const result = await processMapData(sourceFileUrl, mockSaveMapDataHookFn, undefined, mockLogger);

            expect(result).toBeInstanceOf(MapData);
            expect(result.id).toBe(mockMapDataId);
            expect(result.errorMessage).toBe('Unsupported file type. Expected .kml or .gpx, got: https://example.com/test.xml');
            expect(result.sourceFileUrl).toBe(sourceFileUrl);
            expect(mockDownloadSourceFile).not.toHaveBeenCalled();
            expect(mockSaveMapDataHookFn).not.toHaveBeenCalled();
        });

        it('throws error when download fails', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            const downloadError = new Error('Failed to download source file: Network error');
            mockDownloadSourceFile.mockRejectedValueOnce(downloadError);

            await expect(
                processMapData(sourceFileUrl, mockSaveMapDataHookFn),
            ).rejects.toThrow('Failed to download source file: Network error');

            expect(mockConvertToGeoJson).not.toHaveBeenCalled();
            expect(mockConvertToTileDirectory).not.toHaveBeenCalled();
            expect(mockSaveMapDataHookFn).not.toHaveBeenCalled();
        });

        it('returns MapData with error when GeoJSON conversion fails', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            const conversionError = 'Failed to convert to GeoJSON: Invalid XML';
            mockConvertToGeoJson.mockResolvedValueOnce({
                filePath: undefined,
                error: conversionError,
            });

            const result = await processMapData(sourceFileUrl, mockSaveMapDataHookFn, undefined, mockLogger);

            expect(result).toBeInstanceOf(MapData);
            expect(result.errorMessage).toBe(conversionError);
            expect(mockConvertToTileDirectory).not.toHaveBeenCalled();
            expect(mockSaveMapDataHookFn).toHaveBeenCalledWith(
                mockSourceFilePath,
                undefined,
                undefined,
                mockMapDataId,
                true,
                sourceFileUrl,
                conversionError,
                mockLogger,
            );
        });

        it('returns MapData with error when tile directory conversion fails', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            const tileError = 'Failed to convert to tiles: Tippecanoe failed';
            mockConvertToTileDirectory.mockResolvedValueOnce({ error: tileError });

            const result = await processMapData(sourceFileUrl, mockSaveMapDataHookFn, undefined, mockLogger);

            expect(result).toBeInstanceOf(MapData);
            expect(result.errorMessage).toBe(tileError);
            expect(mockSaveMapDataHookFn).toHaveBeenCalledWith(
                mockSourceFilePath,
                mockGeoJsonFilePath,
                undefined,
                mockMapDataId,
                true,
                sourceFileUrl,
                tileError,
                mockLogger,
            );
        });

        it('throws error when download fails, preventing subsequent steps', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            const downloadError = new Error('Failed to download source file: Network error');
            const conversionError = 'Failed to convert to GeoJSON: Invalid XML';
            mockDownloadSourceFile.mockRejectedValueOnce(downloadError);
            mockConvertToGeoJson.mockResolvedValueOnce({
                filePath: undefined,
                error: conversionError,
            });
            mockConvertToTileDirectory.mockResolvedValueOnce({ error: 'Failed to convert to tiles' });

            await expect(
                processMapData(sourceFileUrl, mockSaveMapDataHookFn),
            ).rejects.toThrow('Failed to download source file: Network error');

            // Subsequent steps should be skipped
            expect(mockConvertToGeoJson).not.toHaveBeenCalled();
            expect(mockConvertToTileDirectory).not.toHaveBeenCalled();
        });

        it('throws error when download fails, skipping GeoJSON conversion', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            const downloadError = new Error('Failed to download source file: Network error');
            mockDownloadSourceFile.mockRejectedValueOnce(downloadError);

            await expect(
                processMapData(sourceFileUrl, mockSaveMapDataHookFn),
            ).rejects.toThrow('Failed to download source file: Network error');

            expect(mockConvertToGeoJson).not.toHaveBeenCalled();
            expect(mockConvertToTileDirectory).not.toHaveBeenCalled();
        });

        it('skips tile directory conversion if GeoJSON conversion failed', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            const conversionError = 'Failed to convert to GeoJSON: Invalid XML';
            mockConvertToGeoJson.mockResolvedValueOnce({
                filePath: undefined,
                error: conversionError,
            });

            await processMapData(sourceFileUrl, mockSaveMapDataHookFn, undefined, mockLogger);

            expect(mockConvertToTileDirectory).not.toHaveBeenCalled();
        });

        it('throws error when download fails, skipping all subsequent conversions', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            const downloadError = new Error('Failed to download source file: Network error');
            mockDownloadSourceFile.mockRejectedValueOnce(downloadError);

            await expect(
                processMapData(sourceFileUrl, mockSaveMapDataHookFn),
            ).rejects.toThrow('Failed to download source file: Network error');

            // All subsequent conversions should be skipped
            expect(mockConvertToGeoJson).not.toHaveBeenCalled();
            expect(mockConvertToTileDirectory).not.toHaveBeenCalled();
        });
    });

    describe('hook function error handling', () => {
        it('propagates error when saveMapDataHookFn fails', async () => {
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

            await processMapData(sourceFileUrl, mockSaveMapDataHookFn, undefined, mockLogger);

            expect(mkdtemp).toHaveBeenCalledWith(
                expect.stringContaining(join(tmpdir(), 'map-data-')),
            );
        });

        it('cleans up temp directory after successful processing', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';

            await processMapData(sourceFileUrl, mockSaveMapDataHookFn, undefined, mockLogger);

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

            const result = await processMapData(sourceFileUrl, mockSaveMapDataHookFn, undefined, mockLogger);

            expect(result.kml).toBeDefined();
            expect(result.gpx).toBeUndefined();
            expect(mockSaveMapDataHookFn).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                expect.any(String),
                expect.any(String),
                true, // isKml
                sourceFileUrl,
                undefined,
                mockLogger,
            );
        });

        it('handles uppercase GPX extension', async () => {
            const sourceFileUrl = 'https://example.com/test.GPX';

            const result = await processMapData(sourceFileUrl, mockSaveMapDataHookFn, undefined, mockLogger);

            expect(result.gpx).toBeDefined();
            expect(result.kml).toBeUndefined();
            expect(mockSaveMapDataHookFn).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                expect.any(String),
                expect.any(String),
                false, // isKml
                sourceFileUrl,
                undefined,
                mockLogger,
            );
        });

        it('when downloadSource is false and getSourceFile returns null, returns MapData with errorMessage and does not download', async () => {
            const sourceFileUrl = 'https://example.com/file.kml';
            const errorMapData = new MapData(
                undefined,
                undefined,
                undefined,
                undefined,
                mockMapDataId,
                sourceFileUrl,
                'No existing source file',
            );
            mockSaveMapDataHookFn.mockResolvedValue(errorMapData);
            mockGetSourceFile.mockResolvedValue(null);

            const result = await processMapData(
                sourceFileUrl,
                mockSaveMapDataHookFn,
                mockMapDataId,
                mockLogger,
                undefined,
                false,
            );

            expect(mockDownloadSourceFile).not.toHaveBeenCalled();
            expect(mockGetSourceFile).toHaveBeenCalledWith(mockMapDataId, 'kml');
            expect(result).toBe(errorMapData);
            expect(result.errorMessage).toBe('No existing source file');
            expect(result.gpx).toBeUndefined();
            expect(result.kml).toBeUndefined();
            expect(result.geoJson).toBeUndefined();
            expect(result.tilesTemplate).toBeUndefined();
            expect(mockSaveMapDataHookFn).toHaveBeenCalledWith(
                undefined,
                undefined,
                undefined,
                mockMapDataId,
                true, // isKml from URL
                sourceFileUrl,
                'No existing source file',
                mockLogger,
            );
        });
    });
});

