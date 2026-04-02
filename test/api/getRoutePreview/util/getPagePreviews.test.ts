import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import getPagePreviews from '../../../../src/api/getRoutePreview/util/getPagePreviews';
import type { PagePreview } from 'ropegeo-common/classes';
import { PageDataSource } from 'ropegeo-common/classes';
import { PageRoute, RopewikiRoute } from '../../../../src/types/pageRoute';

let mockGetRopewikiPagePreview: jest.MockedFunction<
    typeof import('../../../../src/api/getRoutePreview/database/getRopewikiPagePreview').default
>;

const mockConn = {} as import('zapatos/db').Queryable;

jest.mock('../../../../src/api/getRoutePreview/database/getRopewikiPagePreview', () => ({
    __esModule: true,
    default: jest.fn(),
}));

describe('getPagePreviews', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetRopewikiPagePreview = require('../../../../src/api/getRoutePreview/database/getRopewikiPagePreview')
            .default;
    });

    it('returns empty array when pageRoutes is empty', async () => {
        const result = await getPagePreviews(mockConn, []);

        expect(result).toEqual([]);
        expect(mockGetRopewikiPagePreview).not.toHaveBeenCalled();
    });

    it('calls getRopewikiPagePreview for each RopewikiRoute and returns previews in order', async () => {
        const routeId = 'fc1abf41-5d4c-44d9-ac73-b0849f8255bb';
        const pageId1 = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        const pageId2 = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
        const rr1 = new RopewikiRoute(routeId, pageId1);
        const rr2 = new RopewikiRoute(routeId, pageId2);

        const preview1: PagePreview = {
            id: pageId1,
            source: PageDataSource.Ropewiki,
            imageUrl: null,
            rating: 4.5,
            ratingCount: 12,
            title: 'First Page',
            regions: ['Utah'],
            difficulty: { technical: '3', water: 'A', time: 'II', risk: null },
            mapData: null,
            externalLink: 'https://ropewiki.com/First_Page',
        };
        const preview2: PagePreview = {
            id: pageId2,
            source: PageDataSource.Ropewiki,
            imageUrl: 'https://example.com/banner.jpg',
            rating: 3,
            ratingCount: 5,
            title: 'Second Page',
            regions: ['Nevada'],
            difficulty: { technical: '2', water: 'B', time: 'I', risk: null },
            mapData: null,
            externalLink: 'https://ropewiki.com/Second_Page',
        };
        mockGetRopewikiPagePreview.mockResolvedValueOnce(preview1).mockResolvedValueOnce(preview2);

        const result = await getPagePreviews(mockConn, [rr1, rr2]);

        expect(mockGetRopewikiPagePreview).toHaveBeenCalledTimes(2);
        expect(mockGetRopewikiPagePreview).toHaveBeenNthCalledWith(1, mockConn, rr1);
        expect(mockGetRopewikiPagePreview).toHaveBeenNthCalledWith(2, mockConn, rr2);
        expect(result).toEqual([preview1, preview2]);
    });

    it('passes conn to getRopewikiPagePreview', async () => {
        const rr = new RopewikiRoute('route-id', 'page-id');
        mockGetRopewikiPagePreview.mockResolvedValue({} as PagePreview);

        await getPagePreviews(mockConn, [rr]);

        expect(mockGetRopewikiPagePreview).toHaveBeenCalledWith(mockConn, rr);
    });

    it('throws for unsupported page route type (plain PageRoute)', async () => {
        const plainRoute = new PageRoute('route-id', 'page-id');

        await expect(getPagePreviews(mockConn, [plainRoute])).rejects.toThrow(
            'Unsupported page route type: PageRoute',
        );
        expect(mockGetRopewikiPagePreview).not.toHaveBeenCalled();
    });

    it('throws before calling getRopewikiPagePreview when first item is unsupported', async () => {
        const plainRoute = new PageRoute('route-id', 'page-id');
        const rr = new RopewikiRoute('route-id', 'page-id');

        await expect(getPagePreviews(mockConn, [plainRoute, rr])).rejects.toThrow(
            'Unsupported page route type: PageRoute',
        );
        expect(mockGetRopewikiPagePreview).not.toHaveBeenCalled();
    });
});
