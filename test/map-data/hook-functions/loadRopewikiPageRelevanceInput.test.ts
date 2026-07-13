import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { loadRopewikiPageRelevanceInput } from '../../../src/map-data/hook-functions/loadRopewikiPageRelevanceInput';

jest.mock('../../../src/map-data/database/getMapDataLegendItems', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../src/map-data/database/getMapDataIdForRopewikiPage', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../src/ropewiki/database/getRopewikiPageRelevanceSourceData', () => ({
    __esModule: true,
    default: jest.fn(),
}));

const getMapDataLegendItems = require('../../../src/map-data/database/getMapDataLegendItems')
    .default as jest.MockedFunction<
    typeof import('../../../src/map-data/database/getMapDataLegendItems').default
>;
const getMapDataIdForRopewikiPage = require('../../../src/map-data/database/getMapDataIdForRopewikiPage')
    .default as jest.MockedFunction<
    typeof import('../../../src/map-data/database/getMapDataIdForRopewikiPage').default
>;
const getRopewikiPageRelevanceSourceData =
    require('../../../src/ropewiki/database/getRopewikiPageRelevanceSourceData')
        .default as jest.MockedFunction<
        typeof import('../../../src/ropewiki/database/getRopewikiPageRelevanceSourceData').default
    >;

describe('loadRopewikiPageRelevanceInput', () => {
    const mockConn = {} as any;

    beforeEach(() => {
        jest.clearAllMocks();
        getRopewikiPageRelevanceSourceData.mockResolvedValue({
            page: {
                id: 'page-1',
                name: 'Test Page',
                url: 'https://ropewiki.com/Test',
                approachLength: { value: 1 },
            } as any,
            betaSections: [{ id: 'b1', title: 'Descent', text: 'text', order: 0 }],
            images: [
                { id: 'img-1', betaSection: 'b1', caption: 'Captioned', order: 0 },
                { id: 'img-2', betaSection: null, caption: null, order: 1 },
            ],
        });
        getMapDataIdForRopewikiPage.mockResolvedValue('map-1');
        getMapDataLegendItems.mockResolvedValue({
            markerRows: [{ id: 'm1', name: 'Trailhead' }],
            segmentRows: [{ id: 's1', name: 'Trail' }],
            polygonRows: [],
        } as any);
    });

    it('assembles legend items, captioned images, and page stats', async () => {
        const result = await loadRopewikiPageRelevanceInput(mockConn, 'page-1');

        expect(result.mapDataId).toBe('map-1');
        expect(result.legendItems).toEqual([
            { id: 'm1', featureType: 'point', name: 'Trailhead' },
            { id: 's1', featureType: 'line', name: 'Trail' },
        ]);
        expect(result.images).toEqual([
            {
                id: 'img-1',
                betaSectionId: 'b1',
                betaSectionTitle: 'Descent',
                caption: 'Captioned',
                order: 0,
            },
        ]);
        expect(result.pageStats.approachLength).toEqual({ value: 1 });
    });

    it('skips legend loading when mapDataId is null', async () => {
        getMapDataIdForRopewikiPage.mockResolvedValue(null);

        const result = await loadRopewikiPageRelevanceInput(mockConn, 'page-1');

        expect(result.mapDataId).toBeNull();
        expect(result.legendItems).toEqual([]);
        expect(getMapDataLegendItems).not.toHaveBeenCalled();
    });
});
