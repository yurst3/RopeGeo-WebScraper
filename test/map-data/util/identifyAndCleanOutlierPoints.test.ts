import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { identifyAndCleanOutlierPoints } from '../../../src/map-data/util/identifyAndCleanOutlierPoints';
import { writeFile } from 'fs/promises';
import { ProgressLogger } from 'ropegeo-common/helpers';

jest.mock('fs/promises', () => ({
    writeFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/map-data/util/outlierTrackPoints', () => ({
    maybeCleanOutlierGeoJson: jest.fn(),
}));

describe('identifyAndCleanOutlierPoints', () => {
    const mockLogger = {
        logProgress: jest.fn(),
    } as unknown as ProgressLogger;

    let mockMaybeCleanOutlierGeoJson: jest.MockedFunction<
        typeof import('../../../src/map-data/util/outlierTrackPoints').maybeCleanOutlierGeoJson
    >;

    beforeEach(() => {
        jest.clearAllMocks();
        mockMaybeCleanOutlierGeoJson = require('../../../src/map-data/util/outlierTrackPoints')
            .maybeCleanOutlierGeoJson;
    });

    it('returns original geojson and does not write when not an outlier', async () => {
        const geojson: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [],
        };
        mockMaybeCleanOutlierGeoJson.mockReturnValue({
            geojson,
            cleaned: false,
            metrics: { classifiedAsOutlier: false } as never,
        });

        const result = await identifyAndCleanOutlierPoints(
            geojson,
            '/tmp/map.geojson',
            'map-id',
            mockLogger,
        );

        expect(result).toBe(geojson);
        expect(writeFile).not.toHaveBeenCalled();
        expect(mockLogger.logProgress).not.toHaveBeenCalled();
    });

    it('writes cleaned geojson and logs when cleaned', async () => {
        const original: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} }],
        };
        const cleaned: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [],
        };
        mockMaybeCleanOutlierGeoJson.mockReturnValue({
            geojson: cleaned,
            cleaned: true,
            metrics: { classifiedAsOutlier: true } as never,
            cleanResult: {
                geojson: cleaned,
                originalFeatureCount: 10,
                keptFeatureCount: 1,
                removedPointCount: 9,
                keptPointCount: 0,
            },
        });

        const result = await identifyAndCleanOutlierPoints(
            original,
            '/tmp/map.geojson',
            'map-id',
            mockLogger,
        );

        expect(result).toBe(cleaned);
        expect(writeFile).toHaveBeenCalledWith('/tmp/map.geojson', JSON.stringify(cleaned), 'utf-8');
        expect(mockLogger.logProgress).toHaveBeenCalledWith(
            expect.stringContaining('Cleaned outlier GeoJSON for map-id'),
        );
    });
});
