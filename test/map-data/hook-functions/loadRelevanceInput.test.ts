import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PageDataSource } from 'ropegeo-common/models';
import {
    loadRelevanceInput,
    registerRelevanceInputHook,
} from '../../../src/map-data/hook-functions/loadRelevanceInput';

jest.mock('../../../src/map-data/hook-functions/loadRopewikiPageRelevanceInput', () => ({
    loadRopewikiPageRelevanceInput: jest.fn(),
}));

const loadRopewikiPageRelevanceInput =
    require('../../../src/map-data/hook-functions/loadRopewikiPageRelevanceInput')
        .loadRopewikiPageRelevanceInput as jest.MockedFunction<
        typeof import('../../../src/map-data/hook-functions/loadRopewikiPageRelevanceInput').loadRopewikiPageRelevanceInput
    >;

describe('loadRelevanceInput', () => {
    const mockConn = {} as any;

    beforeEach(() => {
        jest.clearAllMocks();
        loadRopewikiPageRelevanceInput.mockResolvedValue({
            page: { id: 'p1', name: 'Page', url: 'https://example.com' },
            mapDataId: 'm1',
            legendItems: [],
            betaSections: [],
            images: [],
            pageStats: {},
        });
    });

    it('dispatches Ropewiki pages to loadRopewikiPageRelevanceInput', async () => {
        const result = await loadRelevanceInput(mockConn, 'p1', PageDataSource.Ropewiki);
        expect(loadRopewikiPageRelevanceInput).toHaveBeenCalledWith(mockConn, 'p1');
        expect(result.mapDataId).toBe('m1');
    });

    it('throws for an unregistered pageSource', async () => {
        await expect(
            loadRelevanceInput(mockConn, 'p1', 'unknown' as PageDataSource),
        ).rejects.toThrow('No relevance input hook registered for pageSource: unknown');
    });

    it('uses a custom registered hook when provided', async () => {
        const custom = jest.fn(async () => ({
            page: { id: 'p2', name: 'Custom', url: 'https://example.com/c' },
            mapDataId: null,
            legendItems: [],
            betaSections: [],
            images: [],
            pageStats: {},
        }));
        registerRelevanceInputHook('custom' as PageDataSource, custom as any);

        const result = await loadRelevanceInput(mockConn, 'p2', 'custom' as PageDataSource);
        expect(custom).toHaveBeenCalledWith(mockConn, 'p2', 'custom');
        expect(result.page.name).toBe('Custom');
    });
});
