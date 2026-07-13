import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { reprocessMapDataRelevance } from '../../../src/map-data/lambda-handlers/reprocessMapDataRelevance';

jest.mock('../../../src/helpers/getDatabaseConnection', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../src/map-data/database/listRelevanceReprocessTargets', () => ({
    listRelevanceReprocessTargets: jest.fn(),
}));
jest.mock('../../../src/map-data/database/createFreshRelevanceContextJob', () => ({
    __esModule: true,
    default: jest.fn(),
}));

const mockGetDatabaseConnection = require('../../../src/helpers/getDatabaseConnection')
    .default as jest.MockedFunction<typeof import('../../../src/helpers/getDatabaseConnection').default>;
const mockListRelevanceReprocessTargets =
    require('../../../src/map-data/database/listRelevanceReprocessTargets')
        .listRelevanceReprocessTargets as jest.MockedFunction<
        typeof import('../../../src/map-data/database/listRelevanceReprocessTargets').listRelevanceReprocessTargets
    >;
const mockCreateFreshRelevanceContextJob =
    require('../../../src/map-data/database/createFreshRelevanceContextJob')
        .default as jest.MockedFunction<
        typeof import('../../../src/map-data/database/createFreshRelevanceContextJob').default
    >;

describe('reprocessMapDataRelevance', () => {
    let mockClient: { release: ReturnType<typeof jest.fn> };
    let mockPool: { connect: ReturnType<typeof jest.fn> };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});

        mockClient = { release: jest.fn() };
        mockPool = {
            connect: jest.fn().mockResolvedValue(mockClient),
        };

        mockGetDatabaseConnection.mockResolvedValue(mockPool as never);
        mockListRelevanceReprocessTargets.mockResolvedValue([]);
        mockCreateFreshRelevanceContextJob.mockResolvedValue({ id: 'job-1' } as never);
    });

    it('creates a fresh job for each target and returns enqueuedCount', async () => {
        mockListRelevanceReprocessTargets.mockResolvedValue([
            { pageId: 'p1', mapDataId: 'm1' },
            { pageId: 'p2', mapDataId: 'm2' },
        ]);

        const result = await reprocessMapDataRelevance();

        expect(mockListRelevanceReprocessTargets).toHaveBeenCalledWith(mockClient);
        expect(mockCreateFreshRelevanceContextJob).toHaveBeenCalledTimes(2);
        expect(mockCreateFreshRelevanceContextJob).toHaveBeenNthCalledWith(1, mockClient, {
            mapDataId: 'm1',
            pageId: 'p1',
        });
        expect(mockCreateFreshRelevanceContextJob).toHaveBeenNthCalledWith(2, mockClient, {
            mapDataId: 'm2',
            pageId: 'p2',
        });
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({
            message: 'MapData relevance reprocessor completed successfully',
            enqueuedCount: 2,
        });
        expect(mockClient.release).toHaveBeenCalled();
    });

    it('returns 500 when createFresh fails', async () => {
        mockListRelevanceReprocessTargets.mockResolvedValue([
            { pageId: 'p1', mapDataId: 'm1' },
        ]);
        mockCreateFreshRelevanceContextJob.mockRejectedValue(new Error('enqueue failed'));

        const result = await reprocessMapDataRelevance();

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).error).toContain('enqueue failed');
        expect(mockClient.release).toHaveBeenCalled();
    });
});
