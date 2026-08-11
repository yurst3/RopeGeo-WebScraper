import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { reprocessPageZipper } from '../../../src/page-zipper/lambda-handlers/reprocessPageZipperHandler';

jest.mock('../../../src/page-zipper/database/createFreshPageZipperJob', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../src/page-zipper/database/deleteAllPageZipperJobs', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../src/page-zipper/database/listPageZipReprocessTargets', () => ({
    listPageZipReprocessTargets: jest.fn(),
}));
jest.mock('../../../src/page-zipper/sqs/purgePageZipperQueues', () => ({
    __esModule: true,
    default: jest.fn(),
}));

const mockClient = { release: jest.fn() } as any;
const mockPool = {
    connect: jest.fn(() => Promise.resolve(mockClient)),
} as any;

jest.mock('../../../src/helpers/getDatabaseConnection', () => ({
    __esModule: true,
    default: jest.fn(() => Promise.resolve(mockPool)),
}));

const createFreshPageZipperJob = require('../../../src/page-zipper/database/createFreshPageZipperJob')
    .default as jest.MockedFunction<
    typeof import('../../../src/page-zipper/database/createFreshPageZipperJob').default
>;
const deleteAllPageZipperJobs = require('../../../src/page-zipper/database/deleteAllPageZipperJobs')
    .default as jest.MockedFunction<
    typeof import('../../../src/page-zipper/database/deleteAllPageZipperJobs').default
>;
const { listPageZipReprocessTargets } = require('../../../src/page-zipper/database/listPageZipReprocessTargets') as {
    listPageZipReprocessTargets: jest.MockedFunction<
        typeof import('../../../src/page-zipper/database/listPageZipReprocessTargets').listPageZipReprocessTargets
    >;
};
const purgePageZipperQueues = require('../../../src/page-zipper/sqs/purgePageZipperQueues')
    .default as jest.MockedFunction<
    typeof import('../../../src/page-zipper/sqs/purgePageZipperQueues').default
>;

describe('reprocessPageZipperHandler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        listPageZipReprocessTargets.mockResolvedValue([
            { pageId: 'page-1' },
            { pageId: 'page-2' },
        ]);
        createFreshPageZipperJob.mockResolvedValue({} as never);
        deleteAllPageZipperJobs.mockResolvedValue(3);
        purgePageZipperQueues.mockResolvedValue(undefined);
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('creates fresh jobs for each target and returns 200', async () => {
        const result = await reprocessPageZipper({});

        expect(purgePageZipperQueues).not.toHaveBeenCalled();
        expect(createFreshPageZipperJob).toHaveBeenCalledTimes(2);
        expect(createFreshPageZipperJob).toHaveBeenCalledWith(mockClient, {
            pageId: 'page-1',
            pageReady: true,
            imageDataReady: {},
            pageHasMapData: false,
            mapDataLegendItemsReady: {},
        });
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body).enqueuedCount).toBe(2);
        expect(mockClient.release).toHaveBeenCalled();
    });

    it('clears queues and jobs when clearMessagesAndJobs is true', async () => {
        const result = await reprocessPageZipper({ clearMessagesAndJobs: true });

        expect(purgePageZipperQueues).toHaveBeenCalled();
        expect(deleteAllPageZipperJobs).toHaveBeenCalledWith(mockClient);
        expect(JSON.parse(result.body).deletedJobCount).toBe(3);
        expect(result.statusCode).toBe(200);
    });

    it('returns 400 for invalid events', async () => {
        const result = await reprocessPageZipper({ clearMessagesAndJobs: 'yes' });
        expect(result.statusCode).toBe(400);
        expect(createFreshPageZipperJob).not.toHaveBeenCalled();
    });

    it('returns 500 when processing fails', async () => {
        listPageZipReprocessTargets.mockRejectedValue(new Error('db down'));
        const result = await reprocessPageZipper({});
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).error).toBe('db down');
    });
});
