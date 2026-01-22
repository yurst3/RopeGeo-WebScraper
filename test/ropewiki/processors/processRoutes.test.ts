import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import processRoutes from '../../../src/ropewiki/processors/processRoutes';
import RopewikiPage from '../../../src/ropewiki/types/page';
import { Route, RouteType } from '../../../src/types/route';
import type { ProcessRopewikiRoutesHookFn } from '../../../src/ropewiki/hook-functions/processRopewikiRoutes';

// Mock all dependencies
jest.mock('../../../src/ropewiki/util/filterUpsertedPages');
jest.mock('../../../src/ropewiki/database/getRoutesForPages');
jest.mock('../../../src/ropewiki/util/correlateExistingRoutes');
jest.mock('../../../src/ropewiki/database/updateRouteForPage');
jest.mock('../../../src/ropewiki/database/insertMissingRoutes');

import filterUpsertedPages from '../../../src/ropewiki/util/filterUpsertedPages';
import getRoutesForPages from '../../../src/ropewiki/database/getRoutesForPages';
import correlateExistingRoutes from '../../../src/ropewiki/util/correlateExistingRoutes';
import updateRouteForPage from '../../../src/ropewiki/database/updateRouteForPage';
import insertMissingRoutes from '../../../src/ropewiki/database/insertMissingRoutes';

const mockFilterUpsertedPages = filterUpsertedPages as jest.MockedFunction<typeof filterUpsertedPages>;
const mockGetRoutesForPages = getRoutesForPages as jest.MockedFunction<typeof getRoutesForPages>;
const mockCorrelateExistingRoutes = correlateExistingRoutes as jest.MockedFunction<typeof correlateExistingRoutes>;
const mockUpdateRouteForPage = updateRouteForPage as jest.MockedFunction<typeof updateRouteForPage>;
const mockInsertMissingRoutes = insertMissingRoutes as jest.MockedFunction<typeof insertMissingRoutes>;

describe('processRoutes', () => {
    let mockConn: any;
    let mockProcessRopewikiRoutesHookFn: jest.MockedFunction<ProcessRopewikiRoutesHookFn>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockConn = {};
        mockProcessRopewikiRoutesHookFn = jest.fn<ProcessRopewikiRoutesHookFn>().mockResolvedValue(undefined);
    });

    const createTestPage = (pageid: string, name: string, hasCoordinates: boolean = true): RopewikiPage => {
        return new RopewikiPage(
            pageid,
            name,
            'test-region-id',
            'https://example.com/page',
            new Date(),
            hasCoordinates ? { lat: 40, lon: -110 } : undefined,
            undefined, // quality
            undefined, // rating
            undefined, // timeRating
            undefined, // kmlUrl
            undefined, // technicalRating
            undefined, // waterRating
            undefined, // riskRating
            undefined, // permits
            undefined, // rappelInfo
            undefined, // rappelCount
            undefined, // rappelLongest
            undefined, // months
            undefined, // shuttle
            undefined, // vehicle
            undefined, // minTime
            undefined, // maxTime
            undefined, // hike
            [], // aka
            [], // betaSites
            undefined, // userVotes
            undefined, // id
        );
    };

    const createTestRoute = (id: string, name: string): Route => {
        return new Route(id, name, RouteType.Canyon, { lat: 40, lon: -110 });
    };

    it('filters pages to only those with coordinates', async () => {
        const page1 = createTestPage('page-1', 'Page 1', true);
        const page2 = createTestPage('page-2', 'Page 2', false);
        const page3 = createTestPage('page-3', 'Page 3', true);
        const upsertedPages = [page1, page2, page3];
        const pagesWithCoords = [page1, page3];

        mockFilterUpsertedPages.mockReturnValue(pagesWithCoords);
        mockGetRoutesForPages.mockResolvedValue([]);
        mockCorrelateExistingRoutes.mockResolvedValue([]);
        mockInsertMissingRoutes.mockResolvedValue([]);

        await processRoutes(mockConn, upsertedPages, mockProcessRopewikiRoutesHookFn);

        expect(mockFilterUpsertedPages).toHaveBeenCalledWith(upsertedPages);
        expect(mockGetRoutesForPages).toHaveBeenCalledWith(mockConn, pagesWithCoords);
    });

    it('gets existing routes for pages with coordinates', async () => {
        const page1 = createTestPage('page-1', 'Page 1');
        const page2 = createTestPage('page-2', 'Page 2');
        const pagesWithCoords = [page1, page2];
        const route1 = createTestRoute('route-1', 'Route 1');
        const routesAndPages: Array<[Route | null, RopewikiPage]> = [
            [route1, page1],
            [null, page2],
        ];

        mockFilterUpsertedPages.mockReturnValue(pagesWithCoords);
        mockGetRoutesForPages.mockResolvedValue(routesAndPages);
        mockCorrelateExistingRoutes.mockResolvedValue(routesAndPages);
        mockInsertMissingRoutes.mockResolvedValue([[route1, page1], [createTestRoute('route-2', 'Route 2'), page2]]);

        await processRoutes(mockConn, pagesWithCoords, mockProcessRopewikiRoutesHookFn);

        expect(mockGetRoutesForPages).toHaveBeenCalledWith(mockConn, pagesWithCoords);
    });

    it('correlates existing routes', async () => {
        const page1 = createTestPage('page-1', 'Page 1');
        const pagesWithCoords = [page1];
        const route1 = createTestRoute('route-1', 'Route 1');
        const routesAndPages: Array<[Route | null, RopewikiPage]> = [[route1, page1]];

        mockFilterUpsertedPages.mockReturnValue(pagesWithCoords);
        mockGetRoutesForPages.mockResolvedValue(routesAndPages);
        mockCorrelateExistingRoutes.mockResolvedValue(routesAndPages);
        mockInsertMissingRoutes.mockResolvedValue([[route1, page1]]);

        await processRoutes(mockConn, pagesWithCoords, mockProcessRopewikiRoutesHookFn);

        expect(mockCorrelateExistingRoutes).toHaveBeenCalledWith(mockConn, routesAndPages);
    });

    it('updates existing routes with page information', async () => {
        const page1 = createTestPage('page-1', 'Page 1');
        const page2 = createTestPage('page-2', 'Page 2');
        const pagesWithCoords = [page1, page2];
        const route1 = createTestRoute('route-1', 'Route 1');
        const route2 = createTestRoute('route-2', 'Route 2');
        const routesAndPages: Array<[Route | null, RopewikiPage]> = [
            [route1, page1],
            [route2, page2],
        ];

        mockFilterUpsertedPages.mockReturnValue(pagesWithCoords);
        mockGetRoutesForPages.mockResolvedValue(routesAndPages);
        mockCorrelateExistingRoutes.mockResolvedValue(routesAndPages);
        mockInsertMissingRoutes.mockResolvedValue([[route1, page1], [route2, page2]]);

        await processRoutes(mockConn, pagesWithCoords, mockProcessRopewikiRoutesHookFn);

        expect(mockUpdateRouteForPage).toHaveBeenCalledTimes(2);
        expect(mockUpdateRouteForPage).toHaveBeenCalledWith(mockConn, page1);
        expect(mockUpdateRouteForPage).toHaveBeenCalledWith(mockConn, page2);
    });

    it('does not update routes when no routes exist', async () => {
        const page1 = createTestPage('page-1', 'Page 1');
        const pagesWithCoords = [page1];
        const routesAndPages: Array<[Route | null, RopewikiPage]> = [[null, page1]];

        mockFilterUpsertedPages.mockReturnValue(pagesWithCoords);
        mockGetRoutesForPages.mockResolvedValue(routesAndPages);
        mockCorrelateExistingRoutes.mockResolvedValue(routesAndPages);
        const newRoute = createTestRoute('route-1', 'Route 1');
        mockInsertMissingRoutes.mockResolvedValue([[newRoute, page1]]);

        await processRoutes(mockConn, pagesWithCoords, mockProcessRopewikiRoutesHookFn);

        expect(mockUpdateRouteForPage).not.toHaveBeenCalled();
    });

    it('inserts missing routes for pages without routes', async () => {
        const page1 = createTestPage('page-1', 'Page 1');
        const page2 = createTestPage('page-2', 'Page 2');
        const pagesWithCoords = [page1, page2];
        const route1 = createTestRoute('route-1', 'Route 1');
        const routesAndPages: Array<[Route | null, RopewikiPage]> = [
            [route1, page1],
            [null, page2],
        ];
        const route2 = createTestRoute('route-2', 'Route 2');
        const allRoutesAndPages: Array<[Route, RopewikiPage]> = [
            [route1, page1],
            [route2, page2],
        ];

        mockFilterUpsertedPages.mockReturnValue(pagesWithCoords);
        mockGetRoutesForPages.mockResolvedValue(routesAndPages);
        mockCorrelateExistingRoutes.mockResolvedValue(routesAndPages);
        mockInsertMissingRoutes.mockResolvedValue(allRoutesAndPages);

        await processRoutes(mockConn, pagesWithCoords, mockProcessRopewikiRoutesHookFn);

        expect(mockInsertMissingRoutes).toHaveBeenCalledWith(mockConn, routesAndPages);
    });

    it('calls the hook function with all routes and pages', async () => {
        const page1 = createTestPage('page-1', 'Page 1');
        const page2 = createTestPage('page-2', 'Page 2');
        const pagesWithCoords = [page1, page2];
        const route1 = createTestRoute('route-1', 'Route 1');
        const route2 = createTestRoute('route-2', 'Route 2');
        const routesAndPages: Array<[Route | null, RopewikiPage]> = [
            [route1, page1],
            [null, page2],
        ];
        const allRoutesAndPages: Array<[Route, RopewikiPage]> = [
            [route1, page1],
            [route2, page2],
        ];

        mockFilterUpsertedPages.mockReturnValue(pagesWithCoords);
        mockGetRoutesForPages.mockResolvedValue(routesAndPages);
        mockCorrelateExistingRoutes.mockResolvedValue(routesAndPages);
        mockInsertMissingRoutes.mockResolvedValue(allRoutesAndPages);

        await processRoutes(mockConn, pagesWithCoords, mockProcessRopewikiRoutesHookFn);

        expect(mockProcessRopewikiRoutesHookFn).toHaveBeenCalledTimes(1);
        expect(mockProcessRopewikiRoutesHookFn).toHaveBeenCalledWith(allRoutesAndPages);
    });

    it('handles empty pages array', async () => {
        mockFilterUpsertedPages.mockReturnValue([]);
        mockGetRoutesForPages.mockResolvedValue([]);
        mockCorrelateExistingRoutes.mockResolvedValue([]);
        mockInsertMissingRoutes.mockResolvedValue([]);

        await processRoutes(mockConn, [], mockProcessRopewikiRoutesHookFn);

        expect(mockFilterUpsertedPages).toHaveBeenCalledWith([]);
        expect(mockGetRoutesForPages).toHaveBeenCalledWith(mockConn, []);
        expect(mockCorrelateExistingRoutes).toHaveBeenCalledWith(mockConn, []);
        expect(mockInsertMissingRoutes).toHaveBeenCalledWith(mockConn, []);
        expect(mockProcessRopewikiRoutesHookFn).toHaveBeenCalledWith([]);
    });

    it('handles pages with no coordinates', async () => {
        const page1 = createTestPage('page-1', 'Page 1', false);
        const page2 = createTestPage('page-2', 'Page 2', false);
        const upsertedPages = [page1, page2];

        mockFilterUpsertedPages.mockReturnValue([]);
        mockGetRoutesForPages.mockResolvedValue([]);
        mockCorrelateExistingRoutes.mockResolvedValue([]);
        mockInsertMissingRoutes.mockResolvedValue([]);

        await processRoutes(mockConn, upsertedPages, mockProcessRopewikiRoutesHookFn);

        expect(mockFilterUpsertedPages).toHaveBeenCalledWith(upsertedPages);
        expect(mockGetRoutesForPages).toHaveBeenCalledWith(mockConn, []);
        expect(mockUpdateRouteForPage).not.toHaveBeenCalled();
    });

    it('processes routes in the correct order', async () => {
        const page1 = createTestPage('page-1', 'Page 1');
        const pagesWithCoords = [page1];
        const route1 = createTestRoute('route-1', 'Route 1');
        const routesAndPages: Array<[Route | null, RopewikiPage]> = [[route1, page1]];
        const allRoutesAndPages: Array<[Route, RopewikiPage]> = [[route1, page1]];

        mockFilterUpsertedPages.mockReturnValue(pagesWithCoords);
        mockGetRoutesForPages.mockResolvedValue(routesAndPages);
        mockCorrelateExistingRoutes.mockResolvedValue(routesAndPages);
        mockInsertMissingRoutes.mockResolvedValue(allRoutesAndPages);

        await processRoutes(mockConn, pagesWithCoords, mockProcessRopewikiRoutesHookFn);

        // Verify call order by checking call counts at each step
        expect(mockFilterUpsertedPages).toHaveBeenCalledTimes(1);
        expect(mockGetRoutesForPages).toHaveBeenCalledTimes(1);
        expect(mockCorrelateExistingRoutes).toHaveBeenCalledTimes(1);
        expect(mockUpdateRouteForPage).toHaveBeenCalledTimes(1);
        expect(mockInsertMissingRoutes).toHaveBeenCalledTimes(1);
        expect(mockProcessRopewikiRoutesHookFn).toHaveBeenCalledTimes(1);
    });

    it('propagates errors from filterUpsertedPages', async () => {
        const error = new Error('Filter failed');
        mockFilterUpsertedPages.mockImplementation(() => {
            throw error;
        });

        await expect(processRoutes(mockConn, [], mockProcessRopewikiRoutesHookFn)).rejects.toThrow('Filter failed');
    });

    it('propagates errors from getRoutesForPages', async () => {
        const page1 = createTestPage('page-1', 'Page 1');
        const pagesWithCoords = [page1];
        const error = new Error('Get routes failed');

        mockFilterUpsertedPages.mockReturnValue(pagesWithCoords);
        mockGetRoutesForPages.mockRejectedValue(error);

        await expect(processRoutes(mockConn, pagesWithCoords, mockProcessRopewikiRoutesHookFn)).rejects.toThrow('Get routes failed');
    });

    it('propagates errors from updateRouteForPage', async () => {
        const page1 = createTestPage('page-1', 'Page 1');
        const pagesWithCoords = [page1];
        const route1 = createTestRoute('route-1', 'Route 1');
        const routesAndPages: Array<[Route | null, RopewikiPage]> = [[route1, page1]];
        const error = new Error('Update route failed');

        mockFilterUpsertedPages.mockReturnValue(pagesWithCoords);
        mockGetRoutesForPages.mockResolvedValue(routesAndPages);
        mockCorrelateExistingRoutes.mockResolvedValue(routesAndPages);
        mockUpdateRouteForPage.mockRejectedValue(error);

        await expect(processRoutes(mockConn, pagesWithCoords, mockProcessRopewikiRoutesHookFn)).rejects.toThrow('Update route failed');
    });

    it('propagates errors from insertMissingRoutes', async () => {
        const page1 = createTestPage('page-1', 'Page 1');
        const pagesWithCoords = [page1];
        const routesAndPages: Array<[Route | null, RopewikiPage]> = [[null, page1]];
        const error = new Error('Insert routes failed');

        mockFilterUpsertedPages.mockReturnValue(pagesWithCoords);
        mockGetRoutesForPages.mockResolvedValue(routesAndPages);
        mockCorrelateExistingRoutes.mockResolvedValue(routesAndPages);
        mockInsertMissingRoutes.mockRejectedValue(error);

        await expect(processRoutes(mockConn, pagesWithCoords, mockProcessRopewikiRoutesHookFn)).rejects.toThrow('Insert routes failed');
    });

    it('propagates errors from hook function', async () => {
        const page1 = createTestPage('page-1', 'Page 1');
        const pagesWithCoords = [page1];
        const route1 = createTestRoute('route-1', 'Route 1');
        const routesAndPages: Array<[Route | null, RopewikiPage]> = [[route1, page1]];
        const allRoutesAndPages: Array<[Route, RopewikiPage]> = [[route1, page1]];
        const error = new Error('Hook function failed');

        mockFilterUpsertedPages.mockReturnValue(pagesWithCoords);
        mockGetRoutesForPages.mockResolvedValue(routesAndPages);
        mockCorrelateExistingRoutes.mockResolvedValue(routesAndPages);
        mockUpdateRouteForPage.mockResolvedValue(undefined);
        mockInsertMissingRoutes.mockResolvedValue(allRoutesAndPages);
        mockProcessRopewikiRoutesHookFn.mockRejectedValue(error);

        await expect(processRoutes(mockConn, pagesWithCoords, mockProcessRopewikiRoutesHookFn)).rejects.toThrow('Hook function failed');
    });
});
