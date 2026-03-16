import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { convertToTileDirectory } from '../../../src/map-data/util/convertToTileDirectory';
import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { join } from 'path';

jest.mock('child_process', () => ({
    spawn: jest.fn(),
}));

jest.mock('fs/promises', () => ({
    readFile: jest.fn(),
}));

describe('convertToTileDirectory', () => {
    const mockOutputDir = '/tmp/map-data-xyz/tiles';
    const mockMapDataId = '11111111-1111-1111-1111-111111111111';
    const mockGeoJsonFilePath = '/tmp/map-data-xyz/id.geojson';

    let originalEnv: NodeJS.ProcessEnv;
    let mockChild: {
        stderr: { on: jest.Mock };
        on: jest.Mock;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        originalEnv = process.env;
        process.env = { ...originalEnv };

        const geoJsonWithFeatures = JSON.stringify({
            type: 'FeatureCollection',
            features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] } }],
        });
        (readFile as jest.MockedFunction<typeof readFile>).mockResolvedValue(geoJsonWithFeatures);

        mockChild = {
            stderr: { on: jest.fn() },
            on: jest.fn((ev: string, cb: (code?: number) => void) => {
                if (ev === 'close') setTimeout(() => cb(0), 0);
                return mockChild;
            }),
        };
        (spawn as jest.MockedFunction<typeof spawn>).mockReturnValue(mockChild as any);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('returns tilesDir on success when tippecanoe is in PATH', async () => {
        delete process.env.LAMBDA_TASK_ROOT;

        const promise = convertToTileDirectory(mockGeoJsonFilePath, mockOutputDir, mockMapDataId);
        await new Promise((r) => setTimeout(r, 0));
        const result = await promise;

        expect(result).toEqual({ tilesDir: mockOutputDir });
        expect(readFile).toHaveBeenCalledWith(mockGeoJsonFilePath, 'utf-8');
        expect(spawn).toHaveBeenCalledWith(
            'tippecanoe',
            expect.arrayContaining([
                '-e',
                mockOutputDir,
                '-l',
                mockMapDataId,
                '-Z',
                '0',
                '-z',
                '20',
                mockGeoJsonFilePath,
            ]),
            expect.any(Object)
        );
    });

    it('uses LAMBDA_TASK_ROOT for tippecanoe path when set', async () => {
        const lambdaRoot = '/var/task';
        process.env.LAMBDA_TASK_ROOT = lambdaRoot;

        const promise = convertToTileDirectory(mockGeoJsonFilePath, mockOutputDir, mockMapDataId);
        await new Promise((r) => setTimeout(r, 0));
        await promise;

        expect(spawn).toHaveBeenCalledWith(
            join(lambdaRoot, 'tippecanoe'),
            expect.any(Array),
            expect.any(Object)
        );
    });

    it('returns error when GeoJSON has no features', async () => {
        (readFile as jest.MockedFunction<typeof readFile>).mockResolvedValue(
            JSON.stringify({ type: 'FeatureCollection', features: [] })
        );

        const result = await convertToTileDirectory(mockGeoJsonFilePath, mockOutputDir, mockMapDataId);

        expect(result).toEqual({ error: 'Failed to convert to tiles: GeoJSON has no features' });
        expect(spawn).not.toHaveBeenCalled();
    });

    it('returns error when tippecanoe exits non-zero', async () => {
        mockChild.on.mockImplementation((ev: string, cb: (code?: number) => void) => {
            if (ev === 'close') setTimeout(() => cb(1), 0);
            return mockChild;
        });

        const result = await convertToTileDirectory(mockGeoJsonFilePath, mockOutputDir, mockMapDataId);

        expect('error' in result).toBe(true);
        expect((result as { error: string }).error).toContain('tippecanoe exited 1');
    });

    it('returns error when spawn errors', async () => {
        (spawn as jest.MockedFunction<typeof spawn>).mockImplementation(() => {
            const err = new Error('spawn ENOENT');
            setImmediate(() => {
                const onCb = mockChild.on.mock.calls.find((c: string[]) => c[0] === 'error')?.[1];
                if (onCb) onCb(err);
            });
            return mockChild as any;
        });

        const result = await convertToTileDirectory(mockGeoJsonFilePath, mockOutputDir, mockMapDataId);

        expect('error' in result).toBe(true);
        expect((result as { error: string }).error).toContain('spawn ENOENT');
    });
});
