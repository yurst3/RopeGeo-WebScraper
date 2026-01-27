import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { lambdaSaveMapData, nodeSaveMapData } from '../../../src/map-data/hook-functions/saveMapData';
import MapData from '../../../src/map-data/types/mapData';
import { readFile, mkdir, rename, copyFile, unlink } from 'fs/promises';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import ProgressLogger from '../../../src/helpers/progressLogger';

// Mock fs/promises
jest.mock('fs/promises', () => ({
    readFile: jest.fn(),
    mkdir: jest.fn(),
    rename: jest.fn(),
    copyFile: jest.fn(),
    unlink: jest.fn(),
}));

// Mock @aws-sdk/client-s3
const mockSend = jest.fn<() => Promise<any>>();
const mockS3Client = {
    send: mockSend,
};

jest.mock('@aws-sdk/client-s3', () => ({
    S3Client: jest.fn(() => mockS3Client),
    PutObjectCommand: jest.fn(),
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
        const vectorTileFilePath = '/tmp/tiles.mbtiles';
        const bucketName = 'test-bucket';

        beforeEach(() => {
            process.env.MAP_DATA_BUCKET_NAME = bucketName;
            (readFile as jest.MockedFunction<typeof readFile>).mockResolvedValue(Buffer.from('file content'));
            mockSend.mockResolvedValue({});
        });

        it('uploads KML file to S3 and returns correct URLs', async () => {
            const sourceFileUrl = 'https://example.com/file.kml';
            const result = await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                vectorTileFilePath,
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
            expect(result.vectorTile).toBe(`https://${bucketName}.s3.amazonaws.com/vector-tiles/${mapDataId}.mbtiles`);
            expect(result.sourceFileUrl).toBe(sourceFileUrl);
            expect(result.errorMessage).toBeUndefined();
        });

        it('uploads GPX file to S3 and returns correct URLs', async () => {
            const sourceFileUrl = 'https://example.com/file.gpx';
            const result = await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                vectorTileFilePath,
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
            expect(result.vectorTile).toBe(`https://${bucketName}.s3.amazonaws.com/vector-tiles/${mapDataId}.mbtiles`);
            expect(result.sourceFileUrl).toBe(sourceFileUrl);
            expect(result.errorMessage).toBeUndefined();
        });

        it('reads all three files from disk', async () => {
            await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                vectorTileFilePath,
                mapDataId,
                true,
                'https://example.com/file.kml',
                undefined,
                mockLogger,
            );

            expect(readFile).toHaveBeenCalledTimes(3);
            expect(readFile).toHaveBeenCalledWith(sourceFilePath);
            expect(readFile).toHaveBeenCalledWith(geoJsonFilePath);
            expect(readFile).toHaveBeenCalledWith(vectorTileFilePath);
        });

        it('uploads source file with correct KML content type', async () => {
            await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                vectorTileFilePath,
                mapDataId,
                true, // isKml
                'https://example.com/file.kml',
                undefined,
                mockLogger,
            );

            expect(PutObjectCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    Bucket: bucketName,
                    Key: `source/${mapDataId}.kml`,
                    Body: Buffer.from('file content'),
                    ContentType: 'application/vnd.google-earth.kml+xml',
                }),
            );
        });

        it('uploads source file with correct GPX content type', async () => {
            await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                vectorTileFilePath,
                mapDataId,
                false, // isKml
                'https://example.com/file.gpx',
                undefined,
                mockLogger,
            );

            expect(PutObjectCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    Bucket: bucketName,
                    Key: `source/${mapDataId}.gpx`,
                    Body: Buffer.from('file content'),
                    ContentType: 'application/gpx+xml',
                }),
            );
        });

        it('uploads GeoJSON file with correct content type', async () => {
            await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                vectorTileFilePath,
                mapDataId,
                true,
                'https://example.com/file.kml',
                undefined,
                mockLogger,
            );

            expect(PutObjectCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    Bucket: bucketName,
                    Key: `geojson/${mapDataId}.geojson`,
                    Body: Buffer.from('file content'),
                    ContentType: 'application/geo+json',
                }),
            );
        });

        it('uploads vector tile file with correct content type', async () => {
            await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                vectorTileFilePath,
                mapDataId,
                true,
                'https://example.com/file.kml',
                undefined,
                mockLogger,
            );

            expect(PutObjectCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    Bucket: bucketName,
                    Key: `vector-tiles/${mapDataId}.mbtiles`,
                    Body: Buffer.from('file content'),
                    ContentType: 'application/x-protobuf',
                }),
            );
        });

        it('sends all three PutObjectCommands to S3', async () => {
            await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                vectorTileFilePath,
                mapDataId,
                true,
                'https://example.com/file.kml',
                undefined,
                mockLogger,
            );

            expect(mockSend).toHaveBeenCalledTimes(3);
            expect(PutObjectCommand).toHaveBeenCalledTimes(3);
        });

        it('throws error when MAP_DATA_BUCKET_NAME is not set', async () => {
            delete process.env.MAP_DATA_BUCKET_NAME;

            await expect(
                lambdaSaveMapData(
                    sourceFilePath,
                    geoJsonFilePath,
                    vectorTileFilePath,
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
                    vectorTileFilePath,
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
            const readError1 = new Error('Failed to read source file');
            const s3Error2 = new Error('S3 upload failed for GeoJSON');
            const s3Error3 = new Error('S3 upload failed for vector tiles');

            (readFile as jest.MockedFunction<typeof readFile>)
                .mockRejectedValueOnce(readError1)
                .mockResolvedValueOnce(Buffer.from('geojson content'))
                .mockResolvedValueOnce(Buffer.from('tiles content'));
            mockSend
                .mockRejectedValueOnce(s3Error2)
                .mockRejectedValueOnce(s3Error3);

            const result = await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                vectorTileFilePath,
                mapDataId,
                true,
                sourceFileUrl,
                undefined,
                mockLogger,
            );

            expect(result).toBeInstanceOf(MapData);
            expect(result.errorMessage).toBe(
                'Failed to upload source file: Failed to read source file\n' +
                'Failed to upload GeoJSON file: S3 upload failed for GeoJSON\n' +
                'Failed to upload vector tile file: S3 upload failed for vector tiles'
            );
            expect(result.kml).toBeUndefined();
            expect(result.geoJson).toBeUndefined();
            expect(result.vectorTile).toBeUndefined();
        });

        it('collects single upload error into errorMessage', async () => {
            const sourceFileUrl = 'https://example.com/file.kml';
            const s3Error = new Error('S3 upload failed');
            mockSend.mockRejectedValueOnce(s3Error).mockResolvedValueOnce({}).mockResolvedValueOnce({});

            const result = await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                vectorTileFilePath,
                mapDataId,
                true,
                sourceFileUrl,
                undefined,
                mockLogger,
            );

            expect(result.errorMessage).toBe('Failed to upload source file: S3 upload failed');
            expect(result.kml).toBeUndefined();
            expect(result.geoJson).toBeDefined();
            expect(result.vectorTile).toBeDefined();
        });

        it('replaces existing errorMessage with upload errors', async () => {
            const sourceFileUrl = 'https://example.com/file.kml';
            const existingError = 'Previous processing error';
            const s3Error = new Error('S3 upload failed');
            mockSend.mockRejectedValueOnce(s3Error).mockResolvedValueOnce({}).mockResolvedValueOnce({});

            const result = await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                vectorTileFilePath,
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
                vectorTileFilePath,
                mapDataId,
                true,
                sourceFileUrl,
                existingError,
                mockLogger,
            );

            expect(result.errorMessage).toBe(existingError);
            expect(result.kml).toBeDefined();
            expect(result.geoJson).toBeDefined();
            expect(result.vectorTile).toBeDefined();
        });

        it('handles readFile errors and collects them', async () => {
            const sourceFileUrl = 'https://example.com/file.kml';
            const readError = new Error('Failed to read file');
            (readFile as jest.MockedFunction<typeof readFile>).mockRejectedValue(readError);

            const result = await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                vectorTileFilePath,
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
        const vectorTileFilePath = '/tmp/tiles.mbtiles';
        const projectRoot = '/project/root';

        beforeEach(() => {
            process.cwd = jest.fn(() => projectRoot);
            (mkdir as jest.MockedFunction<typeof mkdir>).mockResolvedValue(undefined);
            (rename as jest.MockedFunction<typeof rename>).mockResolvedValue(undefined);
        });

        it('moves KML file to .savedMapData directory and returns correct paths', async () => {
            const sourceFileUrl = 'https://example.com/file.kml';
            const result = await nodeSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                vectorTileFilePath,
                mapDataId,
                true, // isKml
                sourceFileUrl,
                undefined, // errorMessage
                mockLogger,
            );

            const expectedSourcePath = `${projectRoot}/.savedMapData/source/${mapDataId}.kml`;
            const expectedGeoJsonPath = `${projectRoot}/.savedMapData/geojson/${mapDataId}.geojson`;
            const expectedVectorTilePath = `${projectRoot}/.savedMapData/vector-tiles/${mapDataId}.mbtiles`;

            expect(result).toBeInstanceOf(MapData);
            expect(result.kml).toBe(expectedSourcePath);
            expect(result.gpx).toBeUndefined();
            expect(result.geoJson).toBe(expectedGeoJsonPath);
            expect(result.vectorTile).toBe(expectedVectorTilePath);
            expect(result.sourceFileUrl).toBe(sourceFileUrl);
            expect(result.errorMessage).toBeUndefined();
        });

        it('moves GPX file to .savedMapData directory and returns correct paths', async () => {
            const sourceFileUrl = 'https://example.com/file.gpx';
            const result = await nodeSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                vectorTileFilePath,
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
            expect(result.sourceFileUrl).toBe(sourceFileUrl);
        });

        it('creates destination directories before moving files', async () => {
            await nodeSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                vectorTileFilePath,
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
                `${projectRoot}/.savedMapData/vector-tiles`,
                { recursive: true },
            );
        });

        it('renames all three files to destination paths', async () => {
            await nodeSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                vectorTileFilePath,
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
                vectorTileFilePath,
                `${projectRoot}/.savedMapData/vector-tiles/${mapDataId}.mbtiles`,
            );
        });

        it('falls back to copy+unlink when rename fails with EXDEV error', async () => {
            const exdevError = new Error('Cross-device link not permitted');
            (exdevError as any).code = 'EXDEV';
            (rename as jest.MockedFunction<typeof rename>)
                .mockRejectedValueOnce(exdevError)
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined);
            (copyFile as jest.MockedFunction<typeof copyFile>).mockResolvedValue(undefined);
            (unlink as jest.MockedFunction<typeof unlink>).mockResolvedValue(undefined);

            await nodeSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                vectorTileFilePath,
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
            const renameError3 = new Error('Permission denied for vector tiles');

            (rename as jest.MockedFunction<typeof rename>)
                .mockRejectedValueOnce(renameError1)
                .mockRejectedValueOnce(renameError2)
                .mockRejectedValueOnce(renameError3);

            const result = await nodeSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                vectorTileFilePath,
                mapDataId,
                true,
                sourceFileUrl,
                undefined,
                mockLogger,
            );

            expect(result).toBeInstanceOf(MapData);
            expect(result.errorMessage).toBe(
                'Failed to move source file: Permission denied for source\n' +
                'Failed to move GeoJSON file: Permission denied for GeoJSON\n' +
                'Failed to move vector tile file: Permission denied for vector tiles'
            );
            expect(result.kml).toBeUndefined();
            expect(result.geoJson).toBeUndefined();
            expect(result.vectorTile).toBeUndefined();
        });

        it('collects single move error into errorMessage', async () => {
            const sourceFileUrl = 'https://example.com/file.kml';
            const renameError = new Error('Permission denied');
            (rename as jest.MockedFunction<typeof rename>)
                .mockRejectedValueOnce(renameError)
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined);

            const result = await nodeSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                vectorTileFilePath,
                mapDataId,
                true,
                sourceFileUrl,
                undefined,
                mockLogger,
            );

            expect(result.errorMessage).toBe('Failed to move source file: Permission denied');
            expect(result.kml).toBeUndefined();
            expect(result.geoJson).toBeDefined();
            expect(result.vectorTile).toBeDefined();
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
                vectorTileFilePath,
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
                vectorTileFilePath,
                mapDataId,
                true,
                sourceFileUrl,
                existingError,
                mockLogger,
            );

            expect(result.errorMessage).toBe(existingError);
            expect(result.kml).toBeDefined();
            expect(result.geoJson).toBeDefined();
            expect(result.vectorTile).toBeDefined();
        });

        it('handles mkdir errors and collects them', async () => {
            const sourceFileUrl = 'https://example.com/file.kml';
            const mkdirError = new Error('Failed to create directory');
            (mkdir as jest.MockedFunction<typeof mkdir>).mockRejectedValue(mkdirError);

            const result = await nodeSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                vectorTileFilePath,
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
                vectorTileFilePath,
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
        });
    });
});
