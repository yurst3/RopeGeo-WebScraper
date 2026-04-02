import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SearchParams, SearchResults } from 'ropegeo-common/classes';
import { SearchCursor } from 'ropegeo-common/classes';
import searchRopewiki from '../../../../src/api/search/util/searchRopewiki';

const mockConn = {} as import('zapatos/db').Queryable;

let mockGetAllowedRegionIds: jest.MockedFunction<
    typeof import('../../../../src/ropewiki/database/getAllowedRegionIds').default
>;
let mockGetSearchPageIds: jest.MockedFunction<
    typeof import('../../../../src/api/search/database/getSearchPageIds').getSearchPageIds
>;
let mockGetPageRowsByIds: jest.MockedFunction<
    typeof import('../../../../src/api/search/database/getPageRowsByIds').default
>;
let mockGetRegionRowsByIds: jest.MockedFunction<
    typeof import('../../../../src/api/search/database/getRegionRowsByIds').default
>;
let mockEnrichRopewikiPreviews: jest.MockedFunction<
    typeof import('../../../../src/ropewiki/util/enrichRopewikiPreviews').enrichRopewikiPreviews
>;

jest.mock('../../../../src/ropewiki/database/getAllowedRegionIds', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../../src/api/search/database/getSearchPageIds', () => ({
    getSearchPageIds: jest.fn(),
}));

jest.mock('../../../../src/api/search/database/getPageRowsByIds', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../../src/api/search/database/getRegionRowsByIds', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../../src/ropewiki/util/enrichRopewikiPreviews', () => ({
    enrichRopewikiPreviews: jest.fn(),
}));

describe('searchRopewiki', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetAllowedRegionIds =
            require('../../../../src/ropewiki/database/getAllowedRegionIds').default;
        mockGetSearchPageIds =
            require('../../../../src/api/search/database/getSearchPageIds').getSearchPageIds;
        mockGetPageRowsByIds =
            require('../../../../src/api/search/database/getPageRowsByIds').default;
        mockGetRegionRowsByIds =
            require('../../../../src/api/search/database/getRegionRowsByIds').default;
        mockEnrichRopewikiPreviews =
            require('../../../../src/ropewiki/util/enrichRopewikiPreviews').enrichRopewikiPreviews;
    });

    it('returns empty SearchResults when allowedRegionIds is empty', async () => {
        mockGetAllowedRegionIds.mockResolvedValue([]);

        const params = new SearchParams('Test', 0.5, true, true, false, 'similarity', 20);
        const result = await searchRopewiki(mockConn, params);

        expect(mockGetAllowedRegionIds).toHaveBeenCalledWith(mockConn, null);
        expect(mockGetSearchPageIds).not.toHaveBeenCalled();
        expect(result.results).toEqual([]);
        expect(result.nextCursor).toBeNull();
    });

    it('returns empty SearchResults when getSearchPageIds returns no items', async () => {
        mockGetAllowedRegionIds.mockResolvedValue(['region-1']);
        mockGetSearchPageIds.mockResolvedValue({ items: [], hasMore: false });

        const params = new SearchParams('Test', 0.5, true, true, false, 'similarity', 20);
        const result = await searchRopewiki(mockConn, params);

        expect(mockGetSearchPageIds).toHaveBeenCalledWith(
            mockConn,
            params,
            ['region-1'],
        );
        expect(mockGetPageRowsByIds).not.toHaveBeenCalled();
        expect(mockEnrichRopewikiPreviews).not.toHaveBeenCalled();
        expect(result.results).toEqual([]);
        expect(result.nextCursor).toBeNull();
    });

    it('calls getPageRowsByIds, getRegionRowsByIds, enrichRopewikiPreviews and returns SearchResults', async () => {
        const pageId = 'a1000001-0001-4000-8000-000000000001';
        const regionId = 'b1000001-0001-4000-8000-000000000001';
        const items: SearchCursor[] = [
            new SearchCursor(0.9, 'page', pageId),
            new SearchCursor(0.8, 'region', regionId),
        ];
        const mockPageRows = new Map();
        const mockRegionRows = new Map();
        const mockResults = [
            { id: pageId, title: 'Page', regions: ['R1'], source: 'ropewiki' } as unknown,
            { id: regionId, name: 'Region', parents: [], source: 'ropewiki' } as unknown,
        ];

        mockGetAllowedRegionIds.mockResolvedValue([regionId]);
        mockGetSearchPageIds.mockResolvedValue({ items, hasMore: false });
        mockGetPageRowsByIds.mockResolvedValue(mockPageRows);
        mockGetRegionRowsByIds.mockResolvedValue(mockRegionRows);
        mockEnrichRopewikiPreviews.mockResolvedValue(mockResults);

        const params = new SearchParams('Test', 0.5, true, true, false, 'similarity', 20);
        const result = await searchRopewiki(mockConn, params);

        expect(mockGetPageRowsByIds).toHaveBeenCalledWith(
            mockConn,
            'Test',
            0.5,
            [pageId],
            { includeAka: false, applyNameSimilarity: true },
        );
        expect(mockGetRegionRowsByIds).toHaveBeenCalledWith(
            mockConn,
            [regionId],
        );
        expect(mockEnrichRopewikiPreviews).toHaveBeenCalledWith(
            mockConn,
            [
                { type: 'page', id: pageId },
                { type: 'region', id: regionId },
            ],
            mockPageRows,
            mockRegionRows,
        );
        expect(result.results).toEqual(mockResults);
        expect(result.nextCursor).toBeNull();
    });

    it('returns nextCursor when hasMore is true', async () => {
        const pageId = 'a1000001-0001-4000-8000-000000000001';
        const items: SearchCursor[] = [
            new SearchCursor(0.9, 'page', pageId),
        ];
        const lastCursor = new SearchCursor(0.9, 'page', pageId);

        mockGetAllowedRegionIds.mockResolvedValue(['region-1']);
        mockGetSearchPageIds.mockResolvedValue({ items, hasMore: true });
        mockGetPageRowsByIds.mockResolvedValue(new Map([[pageId, {}]]));
        mockGetRegionRowsByIds.mockResolvedValue(new Map());
        mockEnrichRopewikiPreviews.mockResolvedValue([{ id: pageId } as unknown]);

        const params = new SearchParams('Test', 0.5, true, true, false, 'similarity', 20);
        const result = await searchRopewiki(mockConn, params);

        expect(result.nextCursor).not.toBeNull();
        expect(result.results.length).toBe(1);
    });

    it('loads allowed regions with global scope (null region id)', async () => {
        const regionId = 'c0000001-0001-4000-8000-000000000001';
        mockGetAllowedRegionIds.mockResolvedValue([regionId]);
        mockGetSearchPageIds.mockResolvedValue({ items: [], hasMore: false });

        const params = new SearchParams('Test', 0.5, true, true, false, 'similarity', 20);
        await searchRopewiki(mockConn, params);

        expect(mockGetAllowedRegionIds).toHaveBeenCalledWith(mockConn, null);
    });
});
