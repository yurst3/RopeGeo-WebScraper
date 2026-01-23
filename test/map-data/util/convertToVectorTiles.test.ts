import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { convertToVectorTiles } from '../../../src/map-data/util/convertToVectorTiles';
import { exec } from 'child_process';
import { readFile } from 'fs/promises';
import { join } from 'path';

// Mock child_process.exec
jest.mock('child_process', () => ({
    exec: jest.fn(),
}));

// Mock fs/promises
jest.mock('fs/promises', () => ({
    readFile: jest.fn(),
}));

describe('convertToVectorTiles', () => {
    const mockTempDir = '/tmp/map-data-abc123';
    const mockMapDataId = '11111111-1111-1111-1111-111111111111';
    const mockGeoJsonFilePath = join(mockTempDir, `${mockMapDataId}.geojson`);
    const mockVectorTileFilePath = join(mockTempDir, `${mockMapDataId}.mbtiles`);

    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        jest.clearAllMocks();
        originalEnv = process.env;
        process.env = { ...originalEnv };

        // Default mock: GeoJSON with features
        const geoJsonWithFeatures = JSON.stringify({
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [0, 0] },
                },
            ],
        });
        (readFile as jest.MockedFunction<typeof readFile>).mockResolvedValue(geoJsonWithFeatures);

        // Mock exec (tippecanoe) - mock it properly for promisify
        (exec as jest.MockedFunction<typeof exec>).mockImplementation(
            ((command: string, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
                if (callback) {
                    callback(null, '', '');
                }
                return {} as any;
            }) as typeof exec
        );
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('successfully converts GeoJSON to vector tiles when tippecanoe is in PATH', async () => {
        delete process.env.LAMBDA_TASK_ROOT;

        const result = await convertToVectorTiles(mockGeoJsonFilePath, mockTempDir, mockMapDataId);

        expect(result).toEqual({
            filePath: mockVectorTileFilePath,
            error: undefined,
        });
        expect(readFile).toHaveBeenCalledWith(mockGeoJsonFilePath, 'utf-8');
        expect(exec).toHaveBeenCalledTimes(1);
        expect(exec).toHaveBeenCalledWith(
            `tippecanoe -o "${mockVectorTileFilePath}" "${mockGeoJsonFilePath}"`,
            expect.any(Function),
        );
    });

    it('successfully converts GeoJSON to vector tiles when tippecanoe is in LAMBDA_TASK_ROOT', async () => {
        const lambdaTaskRoot = '/var/task';
        process.env.LAMBDA_TASK_ROOT = lambdaTaskRoot;

        const result = await convertToVectorTiles(mockGeoJsonFilePath, mockTempDir, mockMapDataId);

        expect(result).toEqual({
            filePath: mockVectorTileFilePath,
            error: undefined,
        });
        expect(exec).toHaveBeenCalledTimes(1);
        expect(exec).toHaveBeenCalledWith(
            `${join(lambdaTaskRoot, 'tippecanoe')} -o "${mockVectorTileFilePath}" "${mockGeoJsonFilePath}"`,
            expect.any(Function),
        );
    });

    it('returns error when exec throws an error', async () => {
        delete process.env.LAMBDA_TASK_ROOT;
        const execError = new Error('tippecanoe command failed');
        (exec as jest.MockedFunction<typeof exec>).mockImplementation(
            ((command: string, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
                if (callback) {
                    callback(execError, '', '');
                }
                return {} as any;
            }) as typeof exec
        );

        const result = await convertToVectorTiles(mockGeoJsonFilePath, mockTempDir, mockMapDataId);

        expect(result).toEqual({
            filePath: undefined,
            error: 'Failed to convert to vector tiles: tippecanoe command failed',
        });
        expect(exec).toHaveBeenCalledTimes(1);
    });

    it('returns error when exec callback receives an error with stderr', async () => {
        delete process.env.LAMBDA_TASK_ROOT;
        const execError = new Error('tippecanoe: invalid GeoJSON');
        (exec as jest.MockedFunction<typeof exec>).mockImplementation(
            ((command: string, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
                if (callback) {
                    callback(execError, '', 'Error: Invalid GeoJSON format');
                }
                return {} as any;
            }) as typeof exec
        );

        const result = await convertToVectorTiles(mockGeoJsonFilePath, mockTempDir, mockMapDataId);

        expect(result).toEqual({
            filePath: undefined,
            error: 'Failed to convert to vector tiles: tippecanoe: invalid GeoJSON',
        });
        expect(exec).toHaveBeenCalledTimes(1);
    });

    it('handles non-Error thrown values', async () => {
        delete process.env.LAMBDA_TASK_ROOT;
        (exec as jest.MockedFunction<typeof exec>).mockImplementation(
            ((command: string, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
                if (callback) {
                    callback('String error' as any, '', '');
                }
                return {} as any;
            }) as typeof exec
        );

        const result = await convertToVectorTiles(mockGeoJsonFilePath, mockTempDir, mockMapDataId);

        expect(result).toEqual({
            filePath: undefined,
            error: 'Failed to convert to vector tiles: String error',
        });
    });

    it('constructs correct file path for vector tiles', async () => {
        delete process.env.LAMBDA_TASK_ROOT;
        const customMapDataId = '22222222-2222-2222-2222-222222222222';
        const expectedVectorTilePath = join(mockTempDir, `${customMapDataId}.mbtiles`);

        const result = await convertToVectorTiles(mockGeoJsonFilePath, mockTempDir, customMapDataId);

        expect(result.filePath).toBe(expectedVectorTilePath);
        expect(exec).toHaveBeenCalledWith(
            `tippecanoe -o "${expectedVectorTilePath}" "${mockGeoJsonFilePath}"`,
            expect.any(Function),
        );
    });

    it('returns error when GeoJSON has no features', async () => {
        delete process.env.LAMBDA_TASK_ROOT;
        const geoJsonWithoutFeatures = JSON.stringify({
            type: 'FeatureCollection',
            features: [],
        });
        (readFile as jest.MockedFunction<typeof readFile>).mockResolvedValue(geoJsonWithoutFeatures);

        const result = await convertToVectorTiles(mockGeoJsonFilePath, mockTempDir, mockMapDataId);

        expect(result).toEqual({
            filePath: undefined,
            error: 'Failed to convert to vector tiles: GeoJSON has no features',
        });
        expect(readFile).toHaveBeenCalledWith(mockGeoJsonFilePath, 'utf-8');
        expect(exec).not.toHaveBeenCalled();
    });

    it('returns error when GeoJSON has undefined features array', async () => {
        delete process.env.LAMBDA_TASK_ROOT;
        const geoJsonWithoutFeatures = JSON.stringify({
            type: 'FeatureCollection',
        });
        (readFile as jest.MockedFunction<typeof readFile>).mockResolvedValue(geoJsonWithoutFeatures);

        const result = await convertToVectorTiles(mockGeoJsonFilePath, mockTempDir, mockMapDataId);

        expect(result).toEqual({
            filePath: undefined,
            error: 'Failed to convert to vector tiles: GeoJSON has no features',
        });
        expect(readFile).toHaveBeenCalledWith(mockGeoJsonFilePath, 'utf-8');
        expect(exec).not.toHaveBeenCalled();
    });

    it('proceeds with tippecanoe when GeoJSON has features', async () => {
        delete process.env.LAMBDA_TASK_ROOT;
        const geoJsonWithFeatures = JSON.stringify({
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [0, 0] },
                },
            ],
        });
        (readFile as jest.MockedFunction<typeof readFile>).mockResolvedValue(geoJsonWithFeatures);

        const result = await convertToVectorTiles(mockGeoJsonFilePath, mockTempDir, mockMapDataId);

        expect(result).toEqual({
            filePath: mockVectorTileFilePath,
            error: undefined,
        });
        expect(readFile).toHaveBeenCalledWith(mockGeoJsonFilePath, 'utf-8');
        expect(exec).toHaveBeenCalledTimes(1);
    });

    it('returns error when readFile throws an error', async () => {
        delete process.env.LAMBDA_TASK_ROOT;
        const readError = new Error('Failed to read file');
        (readFile as jest.MockedFunction<typeof readFile>).mockRejectedValue(readError);

        const result = await convertToVectorTiles(mockGeoJsonFilePath, mockTempDir, mockMapDataId);

        expect(result).toEqual({
            filePath: undefined,
            error: 'Failed to convert to vector tiles: Failed to read file',
        });
        expect(readFile).toHaveBeenCalledWith(mockGeoJsonFilePath, 'utf-8');
        expect(exec).not.toHaveBeenCalled();
    });

    it('returns error when GeoJSON is invalid JSON', async () => {
        delete process.env.LAMBDA_TASK_ROOT;
        (readFile as jest.MockedFunction<typeof readFile>).mockResolvedValue('invalid json');

        const result = await convertToVectorTiles(mockGeoJsonFilePath, mockTempDir, mockMapDataId);

        expect(result).toEqual({
            filePath: undefined,
            error: expect.stringContaining('Failed to convert to vector tiles'),
        });
        expect(readFile).toHaveBeenCalledWith(mockGeoJsonFilePath, 'utf-8');
        expect(exec).not.toHaveBeenCalled();
    });
});
