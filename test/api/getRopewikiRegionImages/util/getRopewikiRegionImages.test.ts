import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RopewikiRegionImagesParams, RopewikiRegionImageView } from 'ropegeo-common/classes';
import getRopewikiRegionImages from '../../../../src/api/getRopewikiRegionImages/util/getRopewikiRegionImages';

const mockConn = {} as import('zapatos/db').Queryable;

let mockGetAllowedRegionIds: jest.MockedFunction<
    typeof import('../../../../src/ropewiki/database/getAllowedRegionIds').default
>;
let mockGetRegionImagesPage: jest.MockedFunction<
    typeof import('../../../../src/api/getRopewikiRegionImages/database/getRegionImagesPage').getRegionImagesPage
>;

jest.mock('../../../../src/ropewiki/database/getAllowedRegionIds', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../../src/api/getRopewikiRegionImages/database/getRegionImagesPage', () => ({
    getRegionImagesPage: jest.fn(),
    cursorFromRow: jest.fn(),
}));

describe('getRopewikiRegionImages', () => {
    const regionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetAllowedRegionIds =
            require('../../../../src/ropewiki/database/getAllowedRegionIds').default;
        mockGetRegionImagesPage =
            require('../../../../src/api/getRopewikiRegionImages/database/getRegionImagesPage').getRegionImagesPage;
        mockGetAllowedRegionIds.mockResolvedValue([regionId]);
        mockGetRegionImagesPage.mockResolvedValue({ items: [], hasMore: false });
    });

    it('returns empty result when allowedRegionIds is empty', async () => {
        mockGetAllowedRegionIds.mockResolvedValue([]);

        const params = RopewikiRegionImagesParams.fromQueryStringParams({});
        const result = await getRopewikiRegionImages(mockConn, regionId, params);

        expect(mockGetRegionImagesPage).not.toHaveBeenCalled();
        expect(result.results).toEqual([]);
        expect(result.nextCursor).toBeNull();
    });

    it('returns empty result when getRegionImagesPage returns no items', async () => {
        const params = RopewikiRegionImagesParams.fromQueryStringParams({});
        const result = await getRopewikiRegionImages(mockConn, regionId, params);

        expect(mockGetRegionImagesPage).toHaveBeenCalledWith(
            mockConn,
            [regionId],
            params,
        );
        expect(result.results).toEqual([]);
        expect(result.nextCursor).toBeNull();
    });

    it('maps items to RopewikiRegionImageView and returns result with null nextCursor when hasMore is false', async () => {
        const imageId = 'b2c3d4e5-f6a7-8901-bcde-f23456789012';
        const pageId = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
        const items = [
            {
                id: imageId,
                ropewikiPage: pageId,
                pageName: 'Test Page',
                bannerUrl: 'https://example.com/img-banner.jpg',
                fullUrl: 'https://example.com/img-full.jpg',
                linkUrl: 'https://example.com/File:img.jpg',
                caption: null as string | null,
                sort_key: 42,
            },
        ];
        mockGetRegionImagesPage.mockResolvedValue({ items, hasMore: false });

        const params = RopewikiRegionImagesParams.fromQueryStringParams({});
        const result = await getRopewikiRegionImages(mockConn, regionId, params);

        expect(result.results.length).toBe(1);
        const view = result.results[0]!;
        expect(view).toBeInstanceOf(RopewikiRegionImageView);
        expect(view.id).toBe(imageId);
        expect(view.pageId).toBe(pageId);
        expect(view.pageName).toBe('Test Page');
        expect(view.bannerUrl).toBe('https://example.com/img-banner.jpg');
        expect(view.fullUrl).toBe('https://example.com/img-full.jpg');
        expect(view.externalLink).toBe('https://example.com/File:img.jpg');
        expect(result.nextCursor).toBeNull();
    });

    it('includes caption when row has caption', async () => {
        const items = [
            {
                id: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
                ropewikiPage: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
                pageName: 'Page',
                bannerUrl: 'https://example.com/img-banner.jpg',
                fullUrl: 'https://example.com/img-full.jpg',
                linkUrl: 'https://example.com/File:img.jpg',
                caption: 'A caption',
                sort_key: 10,
            },
        ];
        mockGetRegionImagesPage.mockResolvedValue({ items, hasMore: false });

        const params = RopewikiRegionImagesParams.fromQueryStringParams({});
        const result = await getRopewikiRegionImages(mockConn, regionId, params);

        expect(result.results[0]!.caption).toBe('A caption');
    });

    it('returns nextCursor when hasMore is true', async () => {
        const mockCursorEncode = 'base64-encoded-cursor';
        const cursorFromRow =
            require('../../../../src/api/getRopewikiRegionImages/database/getRegionImagesPage').cursorFromRow;
        (cursorFromRow as jest.Mock).mockReturnValue({
            encodeBase64: () => mockCursorEncode,
        });
        const items = [
            {
                id: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
                ropewikiPage: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
                pageName: 'First Page',
                bannerUrl: 'https://example.com/first-banner.jpg',
                fullUrl: 'https://example.com/first-full.jpg',
                linkUrl: 'https://example.com/File:first.jpg',
                caption: null as string | null,
                sort_key: 10,
            },
            {
                id: 'd4e5f6a7-b8c9-0123-def0-234567890123',
                ropewikiPage: 'e5f6a7b8-c9d0-1234-ef01-345678901234',
                pageName: 'Last Page',
                bannerUrl: 'https://example.com/last-banner.jpg',
                fullUrl: 'https://example.com/last-full.jpg',
                linkUrl: 'https://example.com/File:last.jpg',
                caption: null as string | null,
                sort_key: 1,
            },
        ];
        mockGetRegionImagesPage.mockResolvedValue({ items, hasMore: true });

        const params = RopewikiRegionImagesParams.fromQueryStringParams({});
        const result = await getRopewikiRegionImages(mockConn, regionId, params);

        expect(result.results.length).toBe(2);
        expect(result.nextCursor).toBe(mockCursorEncode);
        expect(cursorFromRow).toHaveBeenCalledWith(items[1]);
    });

    it('passes regionId to getAllowedRegionIds and allowedRegionIds plus params to getRegionImagesPage', async () => {
        const params = RopewikiRegionImagesParams.fromQueryStringParams({
            limit: '5',
        });
        await getRopewikiRegionImages(mockConn, regionId, params);

        expect(mockGetAllowedRegionIds).toHaveBeenCalledWith(mockConn, regionId);
        expect(mockGetRegionImagesPage).toHaveBeenCalledWith(
            mockConn,
            [regionId],
            params,
        );
    });
});
