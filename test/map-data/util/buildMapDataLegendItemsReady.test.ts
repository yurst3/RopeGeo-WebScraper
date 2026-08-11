import { describe, it, expect } from '@jest/globals';
import { Bounds, LineLegendItem, PointLegendItem } from 'ropegeo-common/models';
import buildMapDataLegendItemsReady from '../../../src/map-data/util/buildMapDataLegendItemsReady';

describe('buildMapDataLegendItemsReady', () => {
    const legend = {
        s1: new LineLegendItem('s1', 'Segment', new Bounds(40, 39, -110, -111)),
        p1: new PointLegendItem('p1', 'Point', { lat: 40, lon: -111 }),
    };

    it('returns empty object when legend is undefined', () => {
        expect(buildMapDataLegendItemsReady(undefined, true)).toEqual({});
        expect(buildMapDataLegendItemsReady(undefined, false)).toEqual({});
    });

    it('returns empty object when legend has no keys', () => {
        expect(buildMapDataLegendItemsReady({}, true)).toEqual({});
        expect(buildMapDataLegendItemsReady({}, false)).toEqual({});
    });

    it('marks all keys false when processRelevantContext is true', () => {
        expect(buildMapDataLegendItemsReady(legend, true)).toEqual({
            s1: false,
            p1: false,
        });
    });

    it('marks all keys true when processRelevantContext is false', () => {
        expect(buildMapDataLegendItemsReady(legend, false)).toEqual({
            s1: true,
            p1: true,
        });
    });
});
