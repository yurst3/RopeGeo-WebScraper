import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { lambdaSaveMapData, nodeSaveMapData } from '../../../src/map-data/hook-functions/saveMapData';
import { readFile, mkdir, rename, copyFile, unlink } from 'fs/promises';
import { PutObjectCommand } from '@aws-sdk/client-s3';

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

describe('saveMapData hook functions', () => {
    const originalEnv = process.env;
    const originalCwd = process.cwd;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        process.cwd = jest.fn(() => '/project/root');
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
            const result = await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                vectorTileFilePath,
                mapDataId,
                true, // isKml
            );

            expect(result.sourceFile).toBe(`https://${bucketName}.s3.amazonaws.com/source/${mapDataId}.kml`);
            expect(result.geoJsonFile).toBe(`https://${bucketName}.s3.amazonaws.com/geojson/${mapDataId}.geojson`);
            expect(result.vectorTileFile).toBe(`https://${bucketName}.s3.amazonaws.com/vector-tiles/${mapDataId}.mbtiles`);
        });

        it('uploads GPX file to S3 and returns correct URLs', async () => {
            const result = await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                vectorTileFilePath,
                mapDataId,
                false, // isKml
            );

            expect(result.sourceFile).toBe(`https://${bucketName}.s3.amazonaws.com/source/${mapDataId}.gpx`);
            expect(result.geoJsonFile).toBe(`https://${bucketName}.s3.amazonaws.com/geojson/${mapDataId}.geojson`);
            expect(result.vectorTileFile).toBe(`https://${bucketName}.s3.amazonaws.com/vector-tiles/${mapDataId}.mbtiles`);
        });

        it('reads all three files from disk', async () => {
            await lambdaSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                vectorTileFilePath,
                mapDataId,
                true,
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
                ),
            ).rejects.toThrow('MAP_DATA_BUCKET_NAME environment variable is not set');
        });

        it('propagates errors from readFile', async () => {
            const readError = new Error('Failed to read file');
            (readFile as jest.MockedFunction<typeof readFile>).mockRejectedValue(readError);

            await expect(
                lambdaSaveMapData(
                    sourceFilePath,
                    geoJsonFilePath,
                    vectorTileFilePath,
                    mapDataId,
                    true,
                ),
            ).rejects.toThrow('Failed to read file');
        });

        it('propagates errors from S3 upload', async () => {
            const s3Error = new Error('S3 upload failed');
            mockSend.mockRejectedValue(s3Error);

            await expect(
                lambdaSaveMapData(
                    sourceFilePath,
                    geoJsonFilePath,
                    vectorTileFilePath,
                    mapDataId,
                    true,
                ),
            ).rejects.toThrow('S3 upload failed');
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
            const result = await nodeSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                vectorTileFilePath,
                mapDataId,
                true, // isKml
            );

            const expectedSourcePath = `${projectRoot}/.savedMapData/source/${mapDataId}.kml`;
            const expectedGeoJsonPath = `${projectRoot}/.savedMapData/geojson/${mapDataId}.geojson`;
            const expectedVectorTilePath = `${projectRoot}/.savedMapData/vector-tiles/${mapDataId}.mbtiles`;

            expect(result.sourceFile).toBe(expectedSourcePath);
            expect(result.geoJsonFile).toBe(expectedGeoJsonPath);
            expect(result.vectorTileFile).toBe(expectedVectorTilePath);
        });

        it('moves GPX file to .savedMapData directory and returns correct paths', async () => {
            const result = await nodeSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                vectorTileFilePath,
                mapDataId,
                false, // isKml
            );

            const expectedSourcePath = `${projectRoot}/.savedMapData/source/${mapDataId}.gpx`;
            expect(result.sourceFile).toBe(expectedSourcePath);
        });

        it('creates destination directories before moving files', async () => {
            await nodeSaveMapData(
                sourceFilePath,
                geoJsonFilePath,
                vectorTileFilePath,
                mapDataId,
                true,
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
            );

            expect(copyFile).toHaveBeenCalledWith(
                sourceFilePath,
                `${projectRoot}/.savedMapData/source/${mapDataId}.kml`,
            );
            expect(unlink).toHaveBeenCalledWith(sourceFilePath);
        });

        it('propagates non-EXDEV errors from rename', async () => {
            const renameError = new Error('Permission denied');
            (rename as jest.MockedFunction<typeof rename>).mockRejectedValue(renameError);

            await expect(
                nodeSaveMapData(
                    sourceFilePath,
                    geoJsonFilePath,
                    vectorTileFilePath,
                    mapDataId,
                    true,
                ),
            ).rejects.toThrow('Permission denied');
        });

        it('propagates errors from mkdir', async () => {
            const mkdirError = new Error('Failed to create directory');
            (mkdir as jest.MockedFunction<typeof mkdir>).mockRejectedValue(mkdirError);

            await expect(
                nodeSaveMapData(
                    sourceFilePath,
                    geoJsonFilePath,
                    vectorTileFilePath,
                    mapDataId,
                    true,
                ),
            ).rejects.toThrow('Failed to create directory');
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
            );

            expect(process.cwd).toHaveBeenCalled();
            expect(rename).toHaveBeenCalledWith(
                sourceFilePath,
                `${customRoot}/.savedMapData/source/${mapDataId}.kml`,
            );
        });
    });
});
