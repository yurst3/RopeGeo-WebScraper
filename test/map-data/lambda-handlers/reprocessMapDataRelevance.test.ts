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
jest.mock('../../../src/map-data/database/deleteAllRelevantContextJobs', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../src/map-data/sqs/purgeRelevanceQueues', () => ({
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
const mockDeleteAllRelevantContextJobs =
    require('../../../src/map-data/database/deleteAllRelevantContextJobs')
        .default as jest.MockedFunction<
        typeof import('../../../src/map-data/database/deleteAllRelevantContextJobs').default
    >;
const mockPurgeRelevanceQueues = require('../../../src/map-data/sqs/purgeRelevanceQueues')
    .default as jest.MockedFunction<
    typeof import('../../../src/map-data/sqs/purgeRelevanceQueues').default
>;

const SAMPLE_ID = '0827ba8b-27b3-40dc-8385-06f823dbf535';

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
        mockDeleteAllRelevantContextJobs.mockResolvedValue(0);
        mockPurgeRelevanceQueues.mockResolvedValue(undefined);
    });

    it('creates a fresh job for each target and returns enqueuedCount', async () => {
        mockListRelevanceReprocessTargets.mockResolvedValue([
            { pageId: 'p1', mapDataId: 'm1' },
            { pageId: 'p2', mapDataId: 'm2' },
        ]);

        const result = await reprocessMapDataRelevance();

        expect(mockListRelevanceReprocessTargets).toHaveBeenCalledWith(mockClient, undefined);
        expect(mockPurgeRelevanceQueues).not.toHaveBeenCalled();
        expect(mockDeleteAllRelevantContextJobs).not.toHaveBeenCalled();
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
            clearMessagesAndJobs: false,
        });
        expect(mockClient.release).toHaveBeenCalled();
    });

    it('purges queues and deletes jobs when clearMessagesAndJobs is true', async () => {
        mockDeleteAllRelevantContextJobs.mockResolvedValue(4);
        mockListRelevanceReprocessTargets.mockResolvedValue([
            { pageId: 'p1', mapDataId: 'm1' },
        ]);

        const result = await reprocessMapDataRelevance({ clearMessagesAndJobs: true });

        expect(mockPurgeRelevanceQueues).toHaveBeenCalledTimes(1);
        expect(mockDeleteAllRelevantContextJobs).toHaveBeenCalledWith(mockClient);
        expect(mockListRelevanceReprocessTargets).toHaveBeenCalledWith(mockClient, undefined);
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({
            message: 'MapData relevance reprocessor completed successfully',
            enqueuedCount: 1,
            clearMessagesAndJobs: true,
            deletedJobCount: 4,
        });
    });

    it('passes includeMapDataIds through to listRelevanceReprocessTargets', async () => {
        mockListRelevanceReprocessTargets.mockResolvedValue([
            { pageId: 'p1', mapDataId: SAMPLE_ID },
        ]);

        const result = await reprocessMapDataRelevance({
            includeMapDataIds: [SAMPLE_ID],
        });

        expect(mockListRelevanceReprocessTargets).toHaveBeenCalledWith(mockClient, [SAMPLE_ID]);
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({
            message: 'MapData relevance reprocessor completed successfully',
            enqueuedCount: 1,
            clearMessagesAndJobs: false,
            includeMapDataIds: [SAMPLE_ID],
        });
    });

    it('returns 400 for invalid event payloads', async () => {
        const result = await reprocessMapDataRelevance({ clearMessagesAndJobs: 'yes' });
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).message).toBe('Invalid MapDataRelevanceReprocessorEvent');
        expect(mockGetDatabaseConnection).not.toHaveBeenCalled();
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
