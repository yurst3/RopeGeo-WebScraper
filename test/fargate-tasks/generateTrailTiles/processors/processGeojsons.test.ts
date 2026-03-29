import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { processGeojsons } from '../../../../src/fargate-tasks/generateTrailTiles/processors/processGeojsons';
import { getFeaturesForGeojson } from '../../../../src/fargate-tasks/generateTrailTiles/util/getFeaturesForGeojson';
import { writeGeojsonFile } from '../../../../src/fargate-tasks/generateTrailTiles/util/writeGeojsonFile';

jest.mock('fs', () => ({ mkdirSync: jest.fn() }));
jest.mock('../../../../src/fargate-tasks/generateTrailTiles/util/getFeaturesForGeojson', () => ({
    getFeaturesForGeojson: jest.fn(),
}));
jest.mock('../../../../src/fargate-tasks/generateTrailTiles/util/writeGeojsonFile', () => ({
    writeGeojsonFile: jest.fn(),
}));
const mockLogError = jest.fn();
const mockLogProgress = jest.fn();
const mockGetResults = jest.fn().mockReturnValue({ successes: 0, errors: 0, remaining: 0 });
jest.mock('ropegeo-common/helpers/progressLogger', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        logProgress: mockLogProgress,
        logError: mockLogError,
        getResults: mockGetResults,
    })),
}));

import { mkdirSync } from 'fs';

describe('processGeojsons', () => {
    const geojsonDir = 'geojson';
    const bucket = 'test-bucket';
    const localGeojsonDir = '/tmp/' + geojsonDir;

    beforeEach(() => {
        jest.mocked(mkdirSync).mockClear();
        jest.mocked(getFeaturesForGeojson).mockClear();
        jest.mocked(writeGeojsonFile).mockClear();
        mockLogError.mockClear();
        mockLogProgress.mockClear();
        mockGetResults.mockReturnValue({ successes: 0, errors: 0, remaining: 0 });
    });

    it('creates output dir and processes each id', async () => {
        const ids = ['id-1', 'id-2'];
        jest.mocked(getFeaturesForGeojson)
            .mockResolvedValueOnce([
                { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: { id: 'id-1' } },
            ])
            .mockResolvedValueOnce([
                { type: 'Feature', geometry: { type: 'LineString', coordinates: [[1, 1], [2, 2]] }, properties: { id: 'id-2' } },
            ]);

        await processGeojsons(ids, geojsonDir, bucket);

        expect(mkdirSync).toHaveBeenCalledWith(localGeojsonDir, { recursive: true });
        expect(getFeaturesForGeojson).toHaveBeenCalledTimes(2);
        expect(getFeaturesForGeojson).toHaveBeenNthCalledWith(1, 'id-1', bucket);
        expect(getFeaturesForGeojson).toHaveBeenNthCalledWith(2, 'id-2', bucket);
        expect(writeGeojsonFile).toHaveBeenCalledTimes(2);
        expect(writeGeojsonFile).toHaveBeenNthCalledWith(1, 'id-1', expect.any(Array), localGeojsonDir);
        expect(writeGeojsonFile).toHaveBeenNthCalledWith(2, 'id-2', expect.any(Array), localGeojsonDir);
        expect(mockLogProgress).toHaveBeenCalledTimes(2);
        expect(mockGetResults).toHaveBeenCalled();
    });

    it('calls writeGeojsonFile only when features are non-empty', async () => {
        const ids = ['id-with-features', 'id-empty'];
        jest.mocked(getFeaturesForGeojson)
            .mockResolvedValueOnce([
                { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: { id: 'id-with-features' } },
            ])
            .mockResolvedValueOnce([]);

        await processGeojsons(ids, geojsonDir, bucket);

        expect(writeGeojsonFile).toHaveBeenCalledTimes(1);
        expect(writeGeojsonFile).toHaveBeenCalledWith('id-with-features', expect.any(Array), localGeojsonDir);
        expect(mockLogProgress).toHaveBeenCalledTimes(2);
    });

    it('logs error and skips write when getFeaturesForGeojson throws', async () => {
        const ids = ['id-ok', 'id-fail'];
        jest.mocked(getFeaturesForGeojson)
            .mockResolvedValueOnce([
                { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: { id: 'id-ok' } },
            ])
            .mockRejectedValueOnce(new Error('MapData id-fail: invalid GeoJSON'));

        await processGeojsons(ids, geojsonDir, bucket);

        expect(writeGeojsonFile).toHaveBeenCalledTimes(1);
        expect(writeGeojsonFile).toHaveBeenCalledWith('id-ok', expect.any(Array), localGeojsonDir);
        expect(mockLogError).toHaveBeenCalledWith('MapData id-fail: invalid GeoJSON');
        expect(mockLogProgress).toHaveBeenCalledTimes(1);
    });

    it('calls getResults and logs completion summary', async () => {
        mockGetResults.mockReturnValue({ successes: 2, errors: 0, remaining: 0 });
        jest.mocked(getFeaturesForGeojson).mockResolvedValue([]);
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        await processGeojsons(['a', 'b'], geojsonDir, bucket);

        expect(mockGetResults).toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith('Processing complete: 2 success(es), 0 error(s).');
        consoleSpy.mockRestore();
    });

    it('writes no files and calls no getFeaturesForGeojson when ids is empty', async () => {
        await processGeojsons([], geojsonDir, bucket);

        expect(mkdirSync).toHaveBeenCalledWith(localGeojsonDir, { recursive: true });
        expect(getFeaturesForGeojson).not.toHaveBeenCalled();
        expect(writeGeojsonFile).not.toHaveBeenCalled();
    });
});
