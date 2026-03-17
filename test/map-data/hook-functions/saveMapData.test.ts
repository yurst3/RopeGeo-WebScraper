import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { lambdaSaveMapData, nodeSaveMapData } from '../../../src/map-data/hook-functions/saveMapData';
import MapData from '../../../src/map-data/types/mapData';
import { mkdir, rename, copyFile, unlink, rm } from 'fs/promises';
import ProgressLogger from '../../../src/helpers/progressLogger';

const mockUploadMapDataToS3 = jest.fn<(...args: unknown[]) => Promise<string>>();
const mockUploadMapDataTilesToS3 = jest.fn<(...args: unknown[]) => Promise<string>>();
const mockGetMapData = jest.fn<(...args: unknown[]) => Promise<MapData | null>>();
const mockRelease = jest.fn<() => void>();

jest.mock('../../../src/map-data/s3/uploadMapDataToS3', () => ({
    __esModule: true,
    default: (...args: unknown[]) => mockUploadMapDataToS3(...args),
}));

jest.mock('../../../src/map-data/s3/uploadMapDataTilesToS3', () => ({
    __esModule: true,
    uploadMapDataTilesToS3: (...args: unknown[]) => mockUploadMapDataTilesToS3(...args),
}));

jest.mock('../../../src/map-data/database/getMapData', () => ({
    __esModule: true,
    default: (...args: unknown[]) => mockGetMapData(...args),
}));

jest.mock('../../../src/helpers/getDatabaseConnection', () => ({
    __esModule: true,
    default: jest.fn(() =>
        Promise.resolve({
            connect: () => Promise.resolve({ release: mockRelease }),
        }),
    ),
}));

// Mock fs/promises (used by nodeSaveMapData and moveDirectory)
jest.mock('fs/promises', () => ({
    mkdir: jest.fn(),
    rename: jest.fn(),
    copyFile: jest.fn(),
    unlink: jest.fn(),
    rm: jest.fn(),
}));

// Mock path
jest.mock('path', () => ({
    join: jest.fn((...args: string[]) => args.join('/')),
    dirname: jest.fn((path: string) => path.split('/').slice(0, -1).join('/')),
}));

// Mock ProgressLogger
jest.mock('../../../src/helpers/progressLogger', () => {
    return jest.fn().mockImplementation(() => ({
        setChunk: jest.fn(),
        logProgress: jest.fn(),
        logError: jest.fn(),
        getResults: jest.fn(),
    }));
});

describe('saveMapData hook functions', () => {
    const originalEnv = process.env;
    const originalCwd = process.cwd;
    let mockLogger: any;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        process.cwd = jest.fn(() => '/project/root');
        mockLogger = new ProgressLogger('Test', 1);
    });

    afterEach(() => {
        process.env = originalEnv;
        process.cwd = originalCwd;
    });

    describe('lambdaSaveMapData', () => {
        const mapDataId = '11111111-1111-1111-1111-111111111111';
        const sourceFilePath = '/tmp/source.kml';
        const geoJsonFilePath = '/tmp/data.geojson';
        const tilesDirPath = '/tmp/map-data-xyz/tiles';
        const expectedTilesUrl = 'https://api.example.com/mapdata/tiles/11111111-1111-1111-1111-111111111111/';
        const expectedTilesTemplate = 'https://api.example.com/mapdata/tiles/11111111-1111-1111-1111-111111111111/{z}/{x}/{y}.pbf';
        const bucketName = 'test-bucket';

        beforeEach(() => {
            process.env.MAP_DATA_BUCKET_NAME = bucketName;
            process.env.DEV_ENVIRONMENT = 'prod'; // ensure S3 path is used, not local DB path
            mockUploadMapDataToS3.mockImplementation((_filePath: string, fileKey: string) =>
                Promise.resolve(`https://${bucketName}.s3.amazonaws.com/${fileKey}`),
            );
            mockUploadMapDataTilesToS3.mockResolvedValue(expectedTilesUrl);
        });

        it('when DEV_ENVIRONMENT is local and getMapData returns existing MapData, returns it and logs progress with skip message', async () => {
            process.env.DEV_ENVIRONMENT = 'local';
            const sourceFileUrl = 'https://example.com/file.kml';
            const existingMapData = new MapData(
                undefined,
                'https://bucket.s3.amazonaws.com/source/id.kml',
                'https://bucket.s3.amazonaws.com/geojson/id.geojson',
                undefined,
                mapDataId,
                sourceFileUrl,
            );
            mockGetMapData.mockResolvedValue(existingMapData);

            const result = await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                tilesDirPath,
                mapDataId,
                true,
                sourceFileUrl,
                undefined,
                mockLogger,
            );

            expect(result).toBe(existingMapData);
            expect(mockUploadMapDataToS3).not.toHaveBeenCalled();
            expect(mockUploadMapDataTilesToS3).not.toHaveBeenCalled();
            expect(mockLogger.logProgress).toHaveBeenCalledWith(
                `Map data ${mapDataId} processed successfully - skipping S3 upload because there is no S3 Bucket configured`,
            );
            expect(mockLogger.logError).not.toHaveBeenCalled();
            expect(mockRelease).toHaveBeenCalled();
        });

        it('when DEV_ENVIRONMENT is local and getMapData returns null, logs error with skip message and returns MapData with error', async () => {
            process.env.DEV_ENVIRONMENT = 'local';
            const sourceFileUrl = 'https://example.com/file.kml';
            mockGetMapData.mockResolvedValue(null);

            const result = await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                tilesDirPath,
                mapDataId,
                true,
                sourceFileUrl,
                undefined,
                mockLogger,
            );

            expect(result).toBeInstanceOf(MapData);
            expect(result!.id).toBe(mapDataId);
            expect(result!.sourceFileUrl).toBe(sourceFileUrl);
            expect(result!.errorMessage).toContain('Map data not found');
            expect(result!.errorMessage).toContain('skipping S3 upload because there is no S3 Bucket configured');
            expect(mockUploadMapDataToS3).not.toHaveBeenCalled();
            expect(mockLogger.logError).toHaveBeenCalledWith(
                `Map data ${mapDataId} not found - skipping S3 upload because there is no S3 Bucket configured`,
            );
            expect(mockLogger.logProgress).not.toHaveBeenCalled();
            expect(mockRelease).toHaveBeenCalled();
        });

        it('uploads KML file to S3 and returns correct URLs', async () => {
            const sourceFileUrl = 'https://example.com/file.kml';
            const result = await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                tilesDirPath,
                mapDataId,
                true, // isKml
                sourceFileUrl,
                undefined, // errorMessage
                mockLogger,
            );

            expect(result).toBeInstanceOf(MapData);
            expect(result.kml).toBe(`https://${bucketName}.s3.amazonaws.com/source/${mapDataId}.kml`);
            expect(result.gpx).toBeUndefined();
            expect(result.geoJson).toBe(`https://${bucketName}.s3.amazonaws.com/geojson/${mapDataId}.geojson`);
            expect(result.tilesTemplate).toBe(expectedTilesTemplate);
            expect(result.sourceFileUrl).toBe(sourceFileUrl);
            expect(result.errorMessage).toBeUndefined();
            expect(mockUploadMapDataTilesToS3).toHaveBeenCalledWith(tilesDirPath, mapDataId, bucketName);
        });

        it('uploads GPX file to S3 and returns correct URLs', async () => {
            const sourceFileUrl = 'https://example.com/file.gpx';
            const result = await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                tilesDirPath,
                mapDataId,
                false, // isKml
                sourceFileUrl,
                undefined, // errorMessage
                mockLogger,
            );

            expect(result).toBeInstanceOf(MapData);
            expect(result.gpx).toBe(`https://${bucketName}.s3.amazonaws.com/source/${mapDataId}.gpx`);
            expect(result.kml).toBeUndefined();
            expect(result.geoJson).toBe(`https://${bucketName}.s3.amazonaws.com/geojson/${mapDataId}.geojson`);
            expect(result.tilesTemplate).toBe(expectedTilesTemplate);
            expect(result.sourceFileUrl).toBe(sourceFileUrl);
            expect(result.errorMessage).toBeUndefined();
        });

        it('calls uploadMapDataToS3 twice and uploadMapDataTilesToS3 once with correct args', async () => {
            await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                tilesDirPath,
                mapDataId,
                true,
                'https://example.com/file.kml',
                undefined,
                mockLogger,
            );

            expect(mockUploadMapDataToS3).toHaveBeenCalledTimes(2);
            expect(mockUploadMapDataToS3).toHaveBeenCalledWith(
                sourceFilePath,
                `source/${mapDataId}.kml`,
                'application/vnd.google-earth.kml+xml',
            );
            expect(mockUploadMapDataToS3).toHaveBeenCalledWith(
                geoJsonFilePath,
                `geojson/${mapDataId}.geojson`,
                'application/geo+json',
            );
            expect(mockUploadMapDataTilesToS3).toHaveBeenCalledTimes(1);
            expect(mockUploadMapDataTilesToS3).toHaveBeenCalledWith(tilesDirPath, mapDataId, bucketName);
        });

        it('uploads source file with correct KML content type', async () => {
            await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                tilesDirPath,
                mapDataId,
                true, // isKml
                'https://example.com/file.kml',
                undefined,
                mockLogger,
            );

            expect(mockUploadMapDataToS3).toHaveBeenCalledWith(
                sourceFilePath,
                `source/${mapDataId}.kml`,
                'application/vnd.google-earth.kml+xml',
            );
        });

        it('uploads source file with correct GPX content type', async () => {
            await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                tilesDirPath,
                mapDataId,
                false, // isKml
                'https://example.com/file.gpx',
                undefined,
                mockLogger,
            );

            expect(mockUploadMapDataToS3).toHaveBeenCalledWith(
                sourceFilePath,
                `source/${mapDataId}.gpx`,
                'application/gpx+xml',
            );
        });

        it('uploads GeoJSON file with correct content type', async () => {
            await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                tilesDirPath,
                mapDataId,
                true,
                'https://example.com/file.kml',
                undefined,
                mockLogger,
            );

            expect(mockUploadMapDataToS3).toHaveBeenCalledWith(
                geoJsonFilePath,
                `geojson/${mapDataId}.geojson`,
                'application/geo+json',
            );
        });

        it('does not call uploadMapDataTilesToS3 when tilesDirPath is undefined', async () => {
            await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                undefined, // no tiles dir
                mapDataId,
                true,
                'https://example.com/file.kml',
                undefined,
                mockLogger,
            );

            expect(mockUploadMapDataToS3).toHaveBeenCalledTimes(2);
            expect(mockUploadMapDataTilesToS3).not.toHaveBeenCalled();
        });

        it('throws error when MAP_DATA_BUCKET_NAME is not set', async () => {
            delete process.env.MAP_DATA_BUCKET_NAME;

            await expect(
                lambdaSaveMapData(
                    sourceFilePath,
                    geoJsonFilePath,
                    tilesDirPath,
                    mapDataId,
                    true,
                    'https://example.com/file.kml',
                    undefined,
                    mockLogger,
                ),
            ).rejects.toThrow('MAP_DATA_BUCKET_NAME environment variable is not set');
        });

        it('throws error when MAP_DATA_BUCKET_NAME is empty string', async () => {
            process.env.MAP_DATA_BUCKET_NAME = '';

            await expect(
                lambdaSaveMapData(
                    sourceFilePath,
                    geoJsonFilePath,
                    tilesDirPath,
                    mapDataId,
                    true,
                    'https://example.com/file.kml',
                    undefined,
                    mockLogger,
                ),
            ).rejects.toThrow('MAP_DATA_BUCKET_NAME environment variable is not set');
        });

        it('collects and joins multiple upload errors into errorMessage', async () => {
            const sourceFileUrl = 'https://example.com/file.kml';
            const uploadError1 = new Error('Failed to read source file');
            const uploadError2 = new Error('S3 upload failed for GeoJSON');

            mockUploadMapDataToS3
                .mockRejectedValueOnce(uploadError1)
                .mockRejectedValueOnce(uploadError2);

            const result = await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                tilesDirPath,
                mapDataId,
                true,
                sourceFileUrl,
                undefined,
                mockLogger,
            );

            expect(result).toBeInstanceOf(MapData);
            expect(result.errorMessage).toBe(
                'Failed to upload source file: Failed to read source file\n' +
                'Failed to upload GeoJSON file: S3 upload failed for GeoJSON'
            );
            expect(result.kml).toBeUndefined();
            expect(result.geoJson).toBeUndefined();
            expect(result.tilesTemplate).toBe(expectedTilesTemplate);
        });

        it('collects single upload error into errorMessage', async () => {
            const sourceFileUrl = 'https://example.com/file.kml';
            const uploadError = new Error('S3 upload failed');
            mockUploadMapDataToS3
                .mockRejectedValueOnce(uploadError)
                .mockResolvedValueOnce(`https://${bucketName}.s3.amazonaws.com/geojson/${mapDataId}.geojson`);

            const result = await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                tilesDirPath,
                mapDataId,
                true,
                sourceFileUrl,
                undefined,
                mockLogger,
            );

            expect(result.errorMessage).toBe('Failed to upload source file: S3 upload failed');
            expect(result.kml).toBeUndefined();
            expect(result.geoJson).toBeDefined();
            expect(result.tilesTemplate).toBe(expectedTilesTemplate);
        });

        it('replaces existing errorMessage with upload errors', async () => {
            const sourceFileUrl = 'https://example.com/file.kml';
            const existingError = 'Previous processing error';
            const uploadError = new Error('S3 upload failed');
            mockUploadMapDataToS3
                .mockRejectedValueOnce(uploadError)
                .mockImplementation((_f: string, key: string) =>
                    Promise.resolve(`https://${bucketName}.s3.amazonaws.com/${key}`),
                );

            const result = await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                tilesDirPath,
                mapDataId,
                true,
                sourceFileUrl,
                existingError,
                mockLogger,
            );

            expect(result.errorMessage).toBe('Failed to upload source file: S3 upload failed');
            expect(result.errorMessage).not.toContain(existingError);
        });

        it('preserves existing errorMessage when no upload errors occur', async () => {
            const sourceFileUrl = 'https://example.com/file.kml';
            const existingError = 'Previous processing error';

            const result = await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                tilesDirPath,
                mapDataId,
                true,
                sourceFileUrl,
                existingError,
                mockLogger,
            );

            expect(result.errorMessage).toBe(existingError);
            expect(result.kml).toBeDefined();
            expect(result.geoJson).toBeDefined();
            expect(result.tilesTemplate).toBeDefined();
        });

        it('handles uploadMapDataToS3 errors and collects them', async () => {
            const sourceFileUrl = 'https://example.com/file.kml';
            const uploadError = new Error('Failed to read file');
            mockUploadMapDataToS3.mockRejectedValue(uploadError);

            const result = await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                tilesDirPath,
                mapDataId,
                true,
                sourceFileUrl,
                undefined,
                mockLogger,
            );

            expect(result).toBeInstanceOf(MapData);
            expect(result.errorMessage).toContain('Failed to upload source file: Failed to read file');
        });
    });

    describe('nodeSaveMapData', () => {
        const mapDataId = '22222222-2222-2222-2222-222222222222';
        const sourceFilePath = '/tmp/source.kml';
        const geoJsonFilePath = '/tmp/data.geojson';
        const tilesDirPath = '/tmp/map-data-abc/tiles';
        const projectRoot = '/project/root';
        const expectedTilesPath = `${projectRoot}/.savedMapData/tiles/${mapDataId}`;
        const expectedTilesTemplate = `${expectedTilesPath}/{z}/{x}/{y}.pbf`;

        beforeEach(() => {
            process.cwd = jest.fn(() => projectRoot);
            (mkdir as jest.MockedFunction<typeof mkdir>).mockResolvedValue(undefined);
            (rename as jest.MockedFunction<typeof rename>).mockResolvedValue(undefined);
            (rm as jest.MockedFunction<typeof rm>).mockResolvedValue(undefined);
        });

        it('moves KML file and tiles directory to .savedMapData and returns correct paths', async () => {
            const sourceFileUrl = 'https://example.com/file.kml';
            const result = await nodeSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                tilesDirPath,
                mapDataId,
                true, // isKml
                sourceFileUrl,
                undefined, // errorMessage
                mockLogger,
            );

            const expectedSourcePath = `${projectRoot}/.savedMapData/source/${mapDataId}.kml`;
            const expectedGeoJsonPath = `${projectRoot}/.savedMapData/geojson/${mapDataId}.geojson`;
            expect(result).toBeInstanceOf(MapData);
            expect(result.kml).toBe(expectedSourcePath);
            expect(result.gpx).toBeUndefined();
            expect(result.geoJson).toBe(expectedGeoJsonPath);
            expect(result.tilesTemplate).toBe(expectedTilesTemplate);
            expect(result.sourceFileUrl).toBe(sourceFileUrl);
            expect(result.errorMessage).toBeUndefined();
        });

        it('moves GPX file to .savedMapData directory and returns correct paths', async () => {
            const sourceFileUrl = 'https://example.com/file.gpx';
            const result = await nodeSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                tilesDirPath,
                mapDataId,
                false, // isKml
                sourceFileUrl,
                undefined, // errorMessage
                mockLogger,
            );

            const expectedSourcePath = `${projectRoot}/.savedMapData/source/${mapDataId}.gpx`;
            expect(result).toBeInstanceOf(MapData);
            expect(result.gpx).toBe(expectedSourcePath);
            expect(result.kml).toBeUndefined();
            expect(result.tilesTemplate).toBe(expectedTilesTemplate);
            expect(result.sourceFileUrl).toBe(sourceFileUrl);
        });

        it('creates destination directories before moving files and tiles', async () => {
            await nodeSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                tilesDirPath,
                mapDataId,
                true,
                'https://example.com/file.kml',
                undefined,
                mockLogger,
            );

            expect(mkdir).toHaveBeenCalledTimes(3);
            expect(mkdir).toHaveBeenCalledWith(
                `${projectRoot}/.savedMapData/source`,
                { recursive: true },
            );
            expect(mkdir).toHaveBeenCalledWith(
                `${projectRoot}/.savedMapData/geojson`,
                { recursive: true },
            );
            expect(mkdir).toHaveBeenCalledWith(
                `${projectRoot}/.savedMapData/tiles`,
                { recursive: true },
            );
        });

        it('renames source, GeoJSON, and tiles directory to destination paths', async () => {
            await nodeSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                tilesDirPath,
                mapDataId,
                true,
                'https://example.com/file.kml',
                undefined,
                mockLogger,
            );

            expect(rename).toHaveBeenCalledTimes(3);
            expect(rename).toHaveBeenCalledWith(
                sourceFilePath,
                `${projectRoot}/.savedMapData/source/${mapDataId}.kml`,
            );
            expect(rename).toHaveBeenCalledWith(
                geoJsonFilePath,
                `${projectRoot}/.savedMapData/geojson/${mapDataId}.geojson`,
            );
            expect(rename).toHaveBeenCalledWith(
                tilesDirPath,
                expectedTilesPath,
            );
        });

        it('falls back to copy+unlink when rename fails with EXDEV error', async () => {
            const exdevError = new Error('Cross-device link not permitted');
            (exdevError as any).code = 'EXDEV';
            (rename as jest.MockedFunction<typeof rename>)
                .mockRejectedValueOnce(exdevError)
                .mockResolvedValueOnce(undefined);
            (copyFile as jest.MockedFunction<typeof copyFile>).mockResolvedValue(undefined);
            (unlink as jest.MockedFunction<typeof unlink>).mockResolvedValue(undefined);

            await nodeSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                tilesDirPath,
                mapDataId,
                true,
                'https://example.com/file.kml',
                undefined,
                mockLogger,
            );

            expect(copyFile).toHaveBeenCalledWith(
                sourceFilePath,
                `${projectRoot}/.savedMapData/source/${mapDataId}.kml`,
            );
            expect(unlink).toHaveBeenCalledWith(sourceFilePath);
        });

        it('collects and joins multiple move errors into errorMessage', async () => {
            const sourceFileUrl = 'https://example.com/file.kml';
            const renameError1 = new Error('Permission denied for source');
            const renameError2 = new Error('Permission denied for GeoJSON');

            (rename as jest.MockedFunction<typeof rename>)
                .mockRejectedValueOnce(renameError1)
                .mockRejectedValueOnce(renameError2);

            const result = await nodeSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                tilesDirPath,
                mapDataId,
                true,
                sourceFileUrl,
                undefined,
                mockLogger,
            );

            expect(result).toBeInstanceOf(MapData);
            expect(result.errorMessage).toBe(
                'Failed to move source file: Permission denied for source\n' +
                'Failed to move GeoJSON file: Permission denied for GeoJSON'
            );
            expect(result.kml).toBeUndefined();
            expect(result.geoJson).toBeUndefined();
            expect(result.tilesTemplate).toBe(expectedTilesTemplate);
        });

        it('collects single move error into errorMessage', async () => {
            const sourceFileUrl = 'https://example.com/file.kml';
            const renameError = new Error('Permission denied');
            (rename as jest.MockedFunction<typeof rename>)
                .mockRejectedValueOnce(renameError)
                .mockResolvedValueOnce(undefined);

            const result = await nodeSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                tilesDirPath,
                mapDataId,
                true,
                sourceFileUrl,
                undefined,
                mockLogger,
            );

            expect(result.errorMessage).toBe('Failed to move source file: Permission denied');
            expect(result.kml).toBeUndefined();
            expect(result.geoJson).toBeDefined();
            expect(result.tilesTemplate).toBeDefined();
        });

        it('replaces existing errorMessage with move errors', async () => {
            const sourceFileUrl = 'https://example.com/file.kml';
            const existingError = 'Previous processing error';
            const renameError = new Error('Permission denied');
            (rename as jest.MockedFunction<typeof rename>)
                .mockRejectedValueOnce(renameError)
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined);

            const result = await nodeSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                tilesDirPath,
                mapDataId,
                true,
                sourceFileUrl,
                existingError,
                mockLogger,
            );

            expect(result.errorMessage).toBe('Failed to move source file: Permission denied');
            expect(result.errorMessage).not.toContain(existingError);
        });

        it('preserves existing errorMessage when no move errors occur', async () => {
            const sourceFileUrl = 'https://example.com/file.kml';
            const existingError = 'Previous processing error';

            const result = await nodeSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                tilesDirPath,
                mapDataId,
                true,
                sourceFileUrl,
                existingError,
                mockLogger,
            );

            expect(result.errorMessage).toBe(existingError);
            expect(result.kml).toBeDefined();
            expect(result.geoJson).toBeDefined();
            expect(result.tilesTemplate).toBeDefined();
        });

        it('handles mkdir errors and collects them', async () => {
            const sourceFileUrl = 'https://example.com/file.kml';
            const mkdirError = new Error('Failed to create directory');
            (mkdir as jest.MockedFunction<typeof mkdir>).mockRejectedValue(mkdirError);

            const result = await nodeSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                tilesDirPath,
                mapDataId,
                true,
                sourceFileUrl,
                undefined,
                mockLogger,
            );

            expect(result).toBeInstanceOf(MapData);
            expect(result.errorMessage).toContain('Failed to move source file: Failed to create directory');
        });

        it('uses process.cwd() to determine project root', async () => {
            const customRoot = '/custom/project/root';
            process.cwd = jest.fn(() => customRoot);

            await nodeSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                tilesDirPath,
                mapDataId,
                true,
                'https://example.com/file.kml',
                undefined,
                mockLogger,
            );

            expect(process.cwd).toHaveBeenCalled();
            expect(rename).toHaveBeenCalledWith(
                sourceFilePath,
                `${customRoot}/.savedMapData/source/${mapDataId}.kml`,
            );
            expect(rename).toHaveBeenCalledWith(
                tilesDirPath,
                `${customRoot}/.savedMapData/tiles/${mapDataId}`,
            );
        });
    });
});
