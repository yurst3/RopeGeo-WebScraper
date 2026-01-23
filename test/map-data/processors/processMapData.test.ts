import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { processMapData } from '../../../src/map-data/processors/processMapData';
import MapData from '../../../src/map-data/types/mapData';
import type { SaveMapDataHookFn } from '../../../src/map-data/hook-functions/saveMapData';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

// Mock fs/promises
jest.mock('fs/promises', () => ({
    mkdtemp: jest.fn(),
    rm: jest.fn(),
}));

// Mock crypto.randomUUID
const mockRandomUUID = jest.fn();
jest.mock('crypto', () => ({
    randomUUID: () => mockRandomUUID(),
}));

// Mock utility functions
jest.mock('../../../src/map-data/util/downloadSourceFile', () => ({
    downloadSourceFile: jest.fn(),
}));

jest.mock('../../../src/map-data/util/convertToGeoJson', () => ({
    convertToGeoJson: jest.fn(),
}));

jest.mock('../../../src/map-data/util/convertToVectorTiles', () => ({
    convertToVectorTiles: jest.fn(),
}));

describe('processMapData', () => {
    const mockMapDataId = '11111111-1111-1111-1111-111111111111';
    const mockTempDir = '/tmp/map-data-abc123';
    const mockSourceFilePath = join(mockTempDir, `${mockMapDataId}.kml`);
    const mockGeoJsonFilePath = join(mockTempDir, `${mockMapDataId}.geojson`);
    const mockVectorTileFilePath = join(mockTempDir, `${mockMapDataId}.mbtiles`);
    
    const mockSourceFileContent = '<?xml version="1.0"?><kml></kml>';
    
    let mockSaveMapDataHookFn: jest.MockedFunction<SaveMapDataHookFn>;
    let originalEnv: NodeJS.ProcessEnv;

    let mockDownloadSourceFile: jest.MockedFunction<any>;
    let mockConvertToGeoJson: jest.MockedFunction<any>;
    let mockConvertToVectorTiles: jest.MockedFunction<any>;

    beforeEach(() => {
        jest.clearAllMocks();
        originalEnv = process.env;

        // Setup default mocks
        (mkdtemp as jest.MockedFunction<typeof mkdtemp>).mockResolvedValue(mockTempDir);
        (rm as jest.MockedFunction<typeof rm>).mockResolvedValue(undefined);
        mockRandomUUID.mockReturnValue(mockMapDataId);
        
        // Get mocked utility functions
        const downloadSourceFileModule = require('../../../src/map-data/util/downloadSourceFile');
        const convertToGeoJsonModule = require('../../../src/map-data/util/convertToGeoJson');
        const convertToVectorTilesModule = require('../../../src/map-data/util/convertToVectorTiles');
        
        mockDownloadSourceFile = downloadSourceFileModule.downloadSourceFile;
        mockConvertToGeoJson = convertToGeoJsonModule.convertToGeoJson;
        mockConvertToVectorTiles = convertToVectorTilesModule.convertToVectorTiles;
        
        // Reset and setup mocks with implementations that use the mapDataId parameter
        mockDownloadSourceFile.mockReset();
        mockConvertToGeoJson.mockReset();
        mockConvertToVectorTiles.mockReset();
        
        // Mock utility functions with successful responses
        // Use mockImplementation to construct file path based on isKml parameter
        mockDownloadSourceFile.mockImplementation(
            async (sourceFileUrl: string, tempDir: string, mapDataId: string, isKml: boolean) => {
                const fileExtension = isKml ? 'kml' : 'gpx';
                const filePath = join(tempDir, `${mapDataId}.${fileExtension}`);
                return {
                    filePath,
                    content: mockSourceFileContent,
                    error: undefined,
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

        mockConvertToVectorTiles.mockImplementation(
            async (geoJsonFilePath: string, tempDir: string, mapDataId: string) => {
                const filePath = join(tempDir, `${mapDataId}.mbtiles`);
                return {
                    filePath,
                    error: undefined,
                };
            }
        );

        // Mock save hook function - use parameters passed to it
        mockSaveMapDataHookFn = jest.fn<SaveMapDataHookFn>().mockImplementation(
            async (
                sourceFilePath,
                geoJsonFilePath,
                vectorTileFilePath,
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
                const vectorTileFile = vectorTileFilePath
                    ? `https://s3.amazonaws.com/bucket/vector-tiles/${mapDataId}.mbtiles`
                    : undefined;

                return new MapData(
                    isKml ? undefined : sourceFile, // gpx
                    isKml ? sourceFile : undefined, // kml
                    geoJsonFile, // geoJson
                    vectorTileFile, // vectorTile
                    mapDataId,
                    sourceFileUrl,
                    errorMessage, // errorMessage - use the parameter passed in
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
                    undefined, // gpx
                    'local://source', // kml
                    'local://geojson', // geoJson
                    'local://mbtiles', // vectorTile
                    'test-id', // id
                    'https://example.com/file.kml', // sourceFileUrl
                    undefined, // errorMessage
                ),
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
            expect(result.kml).toBe(`https://s3.amazonaws.com/bucket/source/${mockMapDataId}.kml`);
            expect(result.gpx).toBeUndefined();
            expect(result.geoJson).toBe(`https://s3.amazonaws.com/bucket/geojson/${mockMapDataId}.geojson`);
            expect(result.vectorTile).toBe(`https://s3.amazonaws.com/bucket/vector-tiles/${mockMapDataId}.mbtiles`);
            expect(result.sourceFileUrl).toBe(sourceFileUrl);
            expect(result.errorMessage).toBeUndefined();
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
                sourceFileUrl,
                undefined, // errorMessage
            );
        });

        it('calls downloadSourceFile with correct parameters', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';

            await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            expect(mockDownloadSourceFile).toHaveBeenCalledTimes(1);
            expect(mockDownloadSourceFile).toHaveBeenCalledWith(
                sourceFileUrl,
                mockTempDir,
                mockMapDataId,
                true, // isKml
            );
        });

        it('calls convertToGeoJson with correct parameters', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';

            await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            expect(mockConvertToGeoJson).toHaveBeenCalledTimes(1);
            expect(mockConvertToGeoJson).toHaveBeenCalledWith(
                mockSourceFileContent,
                mockTempDir,
                mockMapDataId,
                true, // isKml
            );
        });

        it('calls convertToVectorTiles with correct parameters', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';

            await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            expect(mockConvertToVectorTiles).toHaveBeenCalledTimes(1);
            expect(mockConvertToVectorTiles).toHaveBeenCalledWith(
                mockGeoJsonFilePath,
                mockTempDir,
                mockMapDataId,
            );
        });
    });

    describe('GPX file processing', () => {
        it('successfully processes a GPX file and returns MapData', async () => {
            const sourceFileUrl = 'https://example.com/test.gpx';

            const result = await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            expect(result).toBeInstanceOf(MapData);
            expect(result.id).toBe(mockMapDataId);
            expect(result.gpx).toBe(`https://s3.amazonaws.com/bucket/source/${mockMapDataId}.gpx`);
            expect(result.kml).toBeUndefined();
            expect(result.geoJson).toBe(`https://s3.amazonaws.com/bucket/geojson/${mockMapDataId}.geojson`);
            expect(result.vectorTile).toBe(`https://s3.amazonaws.com/bucket/vector-tiles/${mockMapDataId}.mbtiles`);
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
                sourceFileUrl,
                undefined, // errorMessage
            );
        });

        it('calls downloadSourceFile with isKml=false for GPX', async () => {
            const sourceFileUrl = 'https://example.com/test.gpx';
            const expectedSourceFilePath = join(mockTempDir, `${mockMapDataId}.gpx`);
            mockDownloadSourceFile.mockResolvedValueOnce({
                filePath: expectedSourceFilePath,
                content: mockSourceFileContent,
                error: undefined,
            });

            await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            expect(mockDownloadSourceFile).toHaveBeenCalledWith(
                sourceFileUrl,
                mockTempDir,
                mockMapDataId,
                false, // isKml
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

            const result = await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            expect(result.id).toBe(generatedId);
            expect(mockRandomUUID).toHaveBeenCalled();
            expect(mockSaveMapDataHookFn).toHaveBeenCalledWith(
                expect.stringContaining(generatedId),
                expect.stringContaining(generatedId),
                expect.stringContaining(generatedId),
                generatedId,
                true,
                sourceFileUrl,
                undefined,
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
                sourceFileUrl,
                undefined,
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

    describe('error handling', () => {
        it('returns MapData with error message for unsupported file types', async () => {
            const sourceFileUrl = 'https://example.com/test.xml';

            const result = await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            expect(result).toBeInstanceOf(MapData);
            expect(result.id).toBe(mockMapDataId);
            expect(result.errorMessage).toBe('Unsupported file type. Expected .kml or .gpx, got: https://example.com/test.xml');
            expect(result.sourceFileUrl).toBe(sourceFileUrl);
            expect(mockDownloadSourceFile).not.toHaveBeenCalled();
            expect(mockSaveMapDataHookFn).not.toHaveBeenCalled();
        });

        it('returns MapData with error when download fails', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            const downloadError = 'Failed to download source file: Network error';
            mockDownloadSourceFile.mockResolvedValueOnce({
                filePath: undefined,
                content: undefined,
                error: downloadError,
            });

            const result = await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            expect(result).toBeInstanceOf(MapData);
            expect(result.errorMessage).toBe(downloadError);
            expect(mockConvertToGeoJson).not.toHaveBeenCalled();
            expect(mockConvertToVectorTiles).not.toHaveBeenCalled();
            expect(mockSaveMapDataHookFn).toHaveBeenCalledWith(
                undefined,
                undefined,
                undefined,
                mockMapDataId,
                true,
                sourceFileUrl,
                downloadError,
            );
        });

        it('returns MapData with error when GeoJSON conversion fails', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            const conversionError = 'Failed to convert to GeoJSON: Invalid XML';
            mockConvertToGeoJson.mockResolvedValueOnce({
                filePath: undefined,
                error: conversionError,
            });

            const result = await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            expect(result).toBeInstanceOf(MapData);
            expect(result.errorMessage).toBe(conversionError);
            expect(mockConvertToVectorTiles).not.toHaveBeenCalled();
            expect(mockSaveMapDataHookFn).toHaveBeenCalledWith(
                mockSourceFilePath,
                undefined,
                undefined,
                mockMapDataId,
                true,
                sourceFileUrl,
                conversionError,
            );
        });

        it('returns MapData with error when vector tile conversion fails', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            const vectorTileError = 'Failed to convert to vector tiles: Tippecanoe failed';
            mockConvertToVectorTiles.mockResolvedValueOnce({
                filePath: undefined,
                error: vectorTileError,
            });

            const result = await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            expect(result).toBeInstanceOf(MapData);
            expect(result.errorMessage).toBe(vectorTileError);
            expect(mockSaveMapDataHookFn).toHaveBeenCalledWith(
                mockSourceFilePath,
                mockGeoJsonFilePath,
                undefined,
                mockMapDataId,
                true,
                sourceFileUrl,
                vectorTileError,
            );
        });

        it('only records the first error encountered', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            const downloadError = 'Failed to download source file: Network error';
            const conversionError = 'Failed to convert to GeoJSON: Invalid XML';
            const vectorTileError = 'Failed to convert to vector tiles: Tippecanoe failed';

            mockDownloadSourceFile.mockResolvedValueOnce({
                filePath: undefined,
                content: undefined,
                error: downloadError,
            });
            mockConvertToGeoJson.mockResolvedValueOnce({
                filePath: undefined,
                error: conversionError,
            });
            mockConvertToVectorTiles.mockResolvedValueOnce({
                filePath: undefined,
                error: vectorTileError,
            });

            const result = await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            // Only the first error (download) should be recorded
            expect(result.errorMessage).toBe(downloadError);
            // Subsequent steps should be skipped
            expect(mockConvertToGeoJson).not.toHaveBeenCalled();
            expect(mockConvertToVectorTiles).not.toHaveBeenCalled();
        });

        it('skips GeoJSON conversion if download failed', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            const downloadError = 'Failed to download source file: Network error';
            mockDownloadSourceFile.mockResolvedValueOnce({
                filePath: undefined,
                content: undefined,
                error: downloadError,
            });

            await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            expect(mockConvertToGeoJson).not.toHaveBeenCalled();
            expect(mockConvertToVectorTiles).not.toHaveBeenCalled();
        });

        it('skips vector tile conversion if GeoJSON conversion failed', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            const conversionError = 'Failed to convert to GeoJSON: Invalid XML';
            mockConvertToGeoJson.mockResolvedValueOnce({
                filePath: undefined,
                error: conversionError,
            });

            await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            expect(mockConvertToVectorTiles).not.toHaveBeenCalled();
        });

        it('skips vector tile conversion if GeoJSON conversion succeeded but errorMessage exists', async () => {
            const sourceFileUrl = 'https://example.com/test.kml';
            const downloadError = 'Failed to download source file: Network error';
            // Even if download fails, we might still have content (edge case)
            mockDownloadSourceFile.mockResolvedValueOnce({
                filePath: undefined,
                content: mockSourceFileContent, // Content exists but error is set
                error: downloadError,
            });

            await processMapData(sourceFileUrl, mockSaveMapDataHookFn);

            // GeoJSON conversion should be skipped because errorMessage exists
            expect(mockConvertToGeoJson).not.toHaveBeenCalled();
            expect(mockConvertToVectorTiles).not.toHaveBeenCalled();
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
                sourceFileUrl,
                undefined,
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
                sourceFileUrl,
                undefined,
            );
        });
    });
});

