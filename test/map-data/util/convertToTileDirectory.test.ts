import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { convertToTileDirectory } from '../../../src/map-data/util/convertToTileDirectory';
import { spawn } from 'child_process';
import { readFile, writeFile, mkdtemp, rm } from 'fs/promises';
import { join } from 'path';

jest.mock('child_process', () => ({
    spawn: jest.fn(),
}));

jest.mock('fs/promises', () => ({
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdtemp: jest.fn(),
    rm: jest.fn(),
}));

describe('convertToTileDirectory', () => {
    const mockOutputDir = '/tmp/map-data-xyz/tiles';
    const mockMapDataId = '11111111-1111-1111-1111-111111111111';
    const mockGeoJsonFilePath = '/tmp/map-data-xyz/id.geojson';
    const mockWorkDir = '/tmp/tippecanoe-abc123';

    let originalEnv: NodeJS.ProcessEnv;
    let mockChild: {
        stderr: { on: jest.Mock };
        on: jest.Mock;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        originalEnv = process.env;
        process.env = { ...originalEnv };

        const geoJsonWithPointAndLine = JSON.stringify({
            type: 'FeatureCollection',
            features: [
                { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] } },
                {
                    type: 'Feature',
                    geometry: { type: 'LineString', coordinates: [
                            [0, 0],
                            [1, 1],
                        ],
                    },
                },
            ],
        });
        (readFile as jest.MockedFunction<typeof readFile>).mockResolvedValue(geoJsonWithPointAndLine);
        (mkdtemp as jest.MockedFunction<typeof mkdtemp>).mockResolvedValue(mockWorkDir);
        (writeFile as jest.MockedFunction<typeof writeFile>).mockResolvedValue(undefined);
        (rm as jest.MockedFunction<typeof rm>).mockResolvedValue(undefined);

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

    it('returns tilesDir after two tippecanoe runs and tile-join when GeoJSON has points and non-points', async () => {
        delete process.env.LAMBDA_TASK_ROOT;

        const promise = convertToTileDirectory(mockGeoJsonFilePath, mockOutputDir, mockMapDataId);
        await new Promise((r) => setTimeout(r, 50));
        const result = await promise;

        expect(result).toEqual({ tilesDir: mockOutputDir });
        expect(readFile).toHaveBeenCalledWith(mockGeoJsonFilePath, 'utf-8');
        expect(mkdtemp).toHaveBeenCalled();
        expect(writeFile).toHaveBeenCalled();
        expect(spawn).toHaveBeenCalledTimes(3);
        const tippecanoeCalls = (spawn as jest.Mock).mock.calls.filter((c) => c[0] === 'tippecanoe');
        expect(tippecanoeCalls).toHaveLength(2);
        const polyArgs = tippecanoeCalls.find((c) => (c[1] as string[]).includes('PolyLines'))?.[1] as string[];
        const pointsArgs = tippecanoeCalls.find((c) => (c[1] as string[]).includes('Points'))?.[1] as string[];
        expect(polyArgs).toEqual(
            expect.arrayContaining(['-l', 'PolyLines', '-o', join(mockWorkDir, 'poly.mbtiles')]),
        );
        expect(polyArgs).not.toContain('-r1');
        expect(polyArgs).not.toContain('--no-clipping');
        expect(polyArgs).not.toContain('--no-duplication');
        expect(pointsArgs).toEqual(
            expect.arrayContaining([
                '-l',
                'Points',
                '-o',
                join(mockWorkDir, 'points.mbtiles'),
                '-r1',
                '--no-clipping',
                '--no-duplication',
            ]),
        );
        expect(spawn).toHaveBeenCalledWith(
            'tile-join',
            ['-e', mockOutputDir, '-f', '-pk', '-pC', join(mockWorkDir, 'poly.mbtiles'), join(mockWorkDir, 'points.mbtiles')],
            expect.any(Object),
        );
        expect(rm).toHaveBeenCalledWith(mockWorkDir, { recursive: true, force: true });
    });

    it('uses LAMBDA_TASK_ROOT for tippecanoe and tile-join paths when set', async () => {
        const lambdaRoot = '/var/task';
        process.env.LAMBDA_TASK_ROOT = lambdaRoot;

        const promise = convertToTileDirectory(mockGeoJsonFilePath, mockOutputDir, mockMapDataId);
        await new Promise((r) => setTimeout(r, 50));
        await promise;

        expect(spawn).toHaveBeenCalledWith(join(lambdaRoot, 'tippecanoe'), expect.any(Array), expect.any(Object));
        expect(spawn).toHaveBeenCalledWith(join(lambdaRoot, 'tile-join'), expect.any(Array), expect.any(Object));
    });

    it('returns error when GeoJSON has no features', async () => {
        (readFile as jest.MockedFunction<typeof readFile>).mockResolvedValue(
            JSON.stringify({ type: 'FeatureCollection', features: [] }),
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
