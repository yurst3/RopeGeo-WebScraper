import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { convertToVectorTiles } from '../../../src/map-data/util/convertToVectorTiles';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';

const execAsync = promisify(exec);

// Mock child_process.exec
jest.mock('child_process', () => ({
    exec: jest.fn(),
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
});
