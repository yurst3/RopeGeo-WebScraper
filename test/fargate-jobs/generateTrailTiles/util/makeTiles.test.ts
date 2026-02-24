import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { makeTiles } from '../../../../src/fargate-jobs/generateTrailTiles/util/makeTiles';
import { spawn } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

jest.mock('child_process', () => ({
    spawn: jest.fn(),
}));
jest.mock('fs', () => ({
    readdirSync: jest.fn(),
    statSync: jest.fn(),
}));

describe('makeTiles (generateTrailTiles)', () => {
    const geojsonDir = 'geojson';
    const tilesDir = 'trails';
    const localGeojsonDir = '/tmp/' + geojsonDir;
    const localTilesDir = '/tmp/' + tilesDir;

    const tippecanoeBaseArgs = [
        '-e', localTilesDir,
        '-l', 'trails',
        '--force',
        '--maximum-zoom=g',
        '--detect-longitude-wraparound',
        '--use-source-polygon-winding',
        '--reverse-source-polygon-winding',
        '--drop-densest-as-needed',
        '--extend-zooms-if-still-dropping',
        '--no-tile-compression',
        '--no-tile-size-limit',
    ];

    beforeEach(() => {
        jest.mocked(spawn).mockReset();
        jest.mocked(statSync).mockImplementation((path: string) => ({
            isDirectory: () => false,
        })) as typeof statSync;
        jest.mocked(readdirSync).mockClear();
    });

    it('spawns tippecanoe with -e output dir and resolves when process exits 0', async () => {
        const mockOn = jest.fn();
        const mockStderrOn = jest.fn();
        jest.mocked(spawn).mockReturnValue({
            stderr: { on: mockStderrOn },
            on: mockOn,
        } as ReturnType<typeof spawn>);

        const promise = makeTiles(geojsonDir, tilesDir);
        const closeCb = mockOn.mock.calls.find((c: [string, (code: number) => void]) => c[0] === 'close')?.[1];
        expect(closeCb).toBeDefined();
        closeCb!(0);
        await promise;

        expect(spawn).toHaveBeenCalledTimes(1);
        expect(spawn).toHaveBeenCalledWith(
            'tippecanoe',
            [...tippecanoeBaseArgs, localGeojsonDir],
            { stdio: ['ignore', 'pipe', 'pipe'] }
        );
    });

    it('when inputPath is a directory, passes all .geojson files to tippecanoe', async () => {
        jest.mocked(statSync).mockReturnValue({ isDirectory: () => true } as ReturnType<typeof statSync>);
        jest.mocked(readdirSync).mockReturnValue(['b.geojson', 'a.geojson', 'other.txt'] as unknown as ReturnType<typeof readdirSync>);

        const mockOn = jest.fn();
        jest.mocked(spawn).mockReturnValue({
            stderr: { on: jest.fn() },
            on: mockOn,
        } as ReturnType<typeof spawn>);

        const promise = makeTiles(geojsonDir, tilesDir);
        const closeCb = mockOn.mock.calls.find((c: [string, (code: number) => void]) => c[0] === 'close')?.[1];
        closeCb!(0);
        await promise;

        expect(readdirSync).toHaveBeenCalledWith(localGeojsonDir);
        expect(spawn).toHaveBeenCalledWith(
            'tippecanoe',
            [...tippecanoeBaseArgs, join(localGeojsonDir, 'a.geojson'), join(localGeojsonDir, 'b.geojson')],
            { stdio: ['ignore', 'pipe', 'pipe'] }
        );
    });

    it('rejects when directory has no .geojson files', async () => {
        jest.mocked(statSync).mockReturnValue({ isDirectory: () => true } as ReturnType<typeof statSync>);
        jest.mocked(readdirSync).mockReturnValue(['file.txt'] as unknown as ReturnType<typeof readdirSync>);

        await expect(makeTiles('empty', tilesDir)).rejects.toThrow('No .geojson files found in /tmp/empty');
        expect(spawn).not.toHaveBeenCalled();
    });

    it('rejects with stderr when process exits non-zero', async () => {
        const mockOn = jest.fn();
        const mockStderrOn = jest.fn((ev: string, cb: (chunk: Buffer | string) => void) => {
            if (ev === 'data') cb('tippecanoe: error message');
        });
        jest.mocked(spawn).mockReturnValue({
            stderr: { on: mockStderrOn },
            on: mockOn,
        } as ReturnType<typeof spawn>);

        const promise = makeTiles(geojsonDir, tilesDir);
        const closeCb = mockOn.mock.calls.find((c: [string, (code: number) => void]) => c[0] === 'close')?.[1];
        closeCb!(1);

        await expect(promise).rejects.toThrow(/tippecanoe exited 1/);
    });
});
