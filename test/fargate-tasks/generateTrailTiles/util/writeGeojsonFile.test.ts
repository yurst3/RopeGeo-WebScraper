import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { writeGeojsonFile } from '../../../../src/fargate-tasks/generateTrailTiles/util/writeGeojsonFile';
import { join } from 'path';

jest.mock('fs', () => ({ writeFileSync: jest.fn() }));

import { writeFileSync } from 'fs';

describe('writeGeojsonFile', () => {
    const outDir = '/tmp/trails';

    beforeEach(() => {
        jest.mocked(writeFileSync).mockClear();
    });

    it('writes a FeatureCollection to {outDir}/{id}.geojson', () => {
        const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        const features = [
            {
                type: 'Feature' as const,
                geometry: { type: 'LineString' as const, coordinates: [[0, 0], [1, 1]] },
                properties: { id, name: 'Trail A' },
            },
        ];

        writeGeojsonFile(id, features, outDir);

        expect(writeFileSync).toHaveBeenCalledTimes(1);
        expect(writeFileSync).toHaveBeenCalledWith(
            join(outDir, `${id}.geojson`),
            expect.any(String),
            'utf8'
        );
        const written = JSON.parse(jest.mocked(writeFileSync).mock.calls[0][1]);
        expect(written).toEqual({
            type: 'FeatureCollection',
            features,
        });
    });

    it('writes empty features array as valid FeatureCollection', () => {
        const id = 'empty-id';

        writeGeojsonFile(id, [], outDir);

        expect(writeFileSync).toHaveBeenCalledWith(
            join(outDir, 'empty-id.geojson'),
            JSON.stringify({ type: 'FeatureCollection', features: [] }),
            'utf8'
        );
    });
});
