import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { makePmtiles } from '../../../../src/fargate-jobs/generateRouteMarkerTiles/util/makePmtiles';
import { spawn } from 'child_process';

jest.mock('child_process', () => ({
    spawn: jest.fn(),
}));

describe('makePmtiles', () => {
    const geojsonPath = '/tmp/routes.geojson';
    const outputPath = '/tmp/routes.pmtiles';

    beforeEach(() => {
        jest.mocked(spawn).mockReset();
    });

    it('spawns tippecanoe with correct args and resolves when process exits 0', async () => {
        const mockOn = jest.fn();
        const mockStderrOn = jest.fn();
        jest.mocked(spawn).mockReturnValue({
            stderr: { on: mockStderrOn },
            on: mockOn,
        } as ReturnType<typeof spawn>);

        const promise = makePmtiles(geojsonPath, outputPath);
        const closeCb = mockOn.mock.calls.find((c: [string, (code: number) => void]) => c[0] === 'close')?.[1];
        expect(closeCb).toBeDefined();
        closeCb!(0);
        await promise;

        expect(spawn).toHaveBeenCalledTimes(1);
        expect(spawn).toHaveBeenCalledWith(
            'tippecanoe',
            ['-o', outputPath, '-l', 'routes', '--force', '--no-tile-compression', geojsonPath],
            { stdio: ['ignore', 'pipe', 'pipe'] }
        );
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

        const promise = makePmtiles(geojsonPath, outputPath);
        const closeCb = mockOn.mock.calls.find((c: [string, (code: number) => void]) => c[0] === 'close')?.[1];
        closeCb!(1);

        await expect(promise).rejects.toThrow(/tippecanoe exited 1/);
        await expect(promise).rejects.toThrow(/tippecanoe: error message/);
    });

    it('rejects when spawn emits error', async () => {
        const mockOn = jest.fn();
        jest.mocked(spawn).mockReturnValue({
            stderr: { on: jest.fn() },
            on: mockOn,
        } as ReturnType<typeof spawn>);

        const promise = makePmtiles(geojsonPath, outputPath);
        const errorCb = mockOn.mock.calls.find((c: [string, (err: Error) => void]) => c[0] === 'error')?.[1];
        const err = new Error('spawn ENOENT');
        errorCb!(err);

        await expect(promise).rejects.toThrow('spawn ENOENT');
    });
});
