import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RopewikiRegionPreviewsParams, PagePreview, RegionPreview } from 'ropegeo-common/classes';
import getRopewikiRegionPreviews from '../../../../src/api/getRopewikiRegionPreviews/util/getRopewikiRegionPreviews';

const mockConn = {} as import('zapatos/db').Queryable;

let mockGetRegionPreviewsPageIds: jest.MockedFunction<
    typeof import('../../../../src/api/getRopewikiRegionPreviews/database/getRegionPreviewsPageIds').getRegionPreviewsPageIds
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

jest.mock('../../../../src/api/getRopewikiRegionPreviews/database/getRegionPreviewsPageIds', () => ({
    getRegionPreviewsPageIds: jest.fn(),
    cursorFromRow: jest.fn(),
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

describe('getRopewikiRegionPreviews', () => {
    const regionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetRegionPreviewsPageIds =
            require('../../../../src/api/getRopewikiRegionPreviews/database/getRegionPreviewsPageIds').getRegionPreviewsPageIds;
        mockGetPageRowsByIds = require('../../../../src/api/search/database/getPageRowsByIds').default;
        mockGetRegionRowsByIds = require('../../../../src/api/search/database/getRegionRowsByIds').default;
        mockEnrichRopewikiPreviews =
            require('../../../../src/ropewiki/util/enrichRopewikiPreviews').enrichRopewikiPreviews;

        mockGetRegionPreviewsPageIds.mockResolvedValue({ items: [], hasMore: false });
        mockEnrichRopewikiPreviews.mockResolvedValue([]);
    });

    it('returns empty result when getRegionPreviewsPageIds returns no items', async () => {
        const params = RopewikiRegionPreviewsParams.fromQueryStringParams({});
        const result = await getRopewikiRegionPreviews(mockConn, regionId, params);

        expect(mockGetRegionPreviewsPageIds).toHaveBeenCalledWith(
            mockConn,
            regionId,
            params,
        );
        expect(mockGetPageRowsByIds).not.toHaveBeenCalled();
        expect(mockGetRegionRowsByIds).not.toHaveBeenCalled();
        expect(mockEnrichRopewikiPreviews).not.toHaveBeenCalled();
        expect(result.results).toEqual([]);
        expect(result.nextCursor).toBeNull();
    });

    it('fetches page and region rows and enriches to PagePreview | RegionPreview', async () => {
        const pageId = 'b2c3d4e5-f6a7-8901-bcde-f23456789012';
        const regionIdFromItems = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
        const items = [
            { type: 'page', id: pageId, sort_key: 20 },
            { type: 'region', id: regionIdFromItems, sort_key: 10 },
        ];
        mockGetRegionPreviewsPageIds.mockResolvedValue({ items, hasMore: false });

        const mockPagePreview = { title: 'Test Page', id: pageId } as unknown as PagePreview;
        const mockRegionPreview = { name: 'Test Region', id: regionIdFromItems } as unknown as RegionPreview;
        mockGetPageRowsByIds.mockResolvedValue(new Map([[pageId, {} as never]]));
        mockGetRegionRowsByIds.mockResolvedValue(new Map([[regionIdFromItems, {} as never]]));
        mockEnrichRopewikiPreviews.mockResolvedValue([mockPagePreview, mockRegionPreview]);

        const params = RopewikiRegionPreviewsParams.fromQueryStringParams({});
        const result = await getRopewikiRegionPreviews(mockConn, regionId, params);

        expect(mockGetPageRowsByIds).toHaveBeenCalledWith(
            mockConn,
            '',
            0,
            [pageId],
            { includeAka: true },
        );
        expect(mockGetRegionRowsByIds).toHaveBeenCalledWith(mockConn, [regionIdFromItems]);
        expect(mockEnrichRopewikiPreviews).toHaveBeenCalledWith(
            mockConn,
            items.map((r) => ({ type: r.type as 'page' | 'region', id: r.id })),
            expect.any(Map),
            expect.any(Map),
        );
        expect(result.results).toHaveLength(2);
        expect(result.results[0]).toBe(mockPagePreview);
        expect(result.results[1]).toBe(mockRegionPreview);
        expect(result.nextCursor).toBeNull();
    });

    it('returns nextCursor when hasMore is true', async () => {
        const mockCursorEncode = 'base64-encoded-cursor';
        const cursorFromRow =
            require('../../../../src/api/getRopewikiRegionPreviews/database/getRegionPreviewsPageIds').cursorFromRow;
        (cursorFromRow as jest.Mock).mockReturnValue({
            encodeBase64: () => mockCursorEncode,
        });
        const items = [
            { type: 'page', id: 'b2c3d4e5-f6a7-8901-bcde-f23456789012', sort_key: 10 },
            { type: 'region', id: 'c3d4e5f6-a7b8-9012-cdef-123456789012', sort_key: 1 },
        ];
        mockGetRegionPreviewsPageIds.mockResolvedValue({ items, hasMore: true });
        mockEnrichRopewikiPreviews.mockResolvedValue([{} as PagePreview, {} as RegionPreview]);

        const params = RopewikiRegionPreviewsParams.fromQueryStringParams({});
        const result = await getRopewikiRegionPreviews(mockConn, regionId, params);

        expect(result.results).toHaveLength(2);
        expect(result.nextCursor).toBe(mockCursorEncode);
        expect(cursorFromRow).toHaveBeenCalledWith(items[1]);
    });

    it('passes regionId and params to getRegionPreviewsPageIds', async () => {
        const params = RopewikiRegionPreviewsParams.fromQueryStringParams({
            limit: '5',
        });
        await getRopewikiRegionPreviews(mockConn, regionId, params);

        expect(mockGetRegionPreviewsPageIds).toHaveBeenCalledWith(
            mockConn,
            regionId,
            params,
        );
    });
});
