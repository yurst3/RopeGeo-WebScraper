import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PageDataSource } from 'ropegeo-common/models';
import tryEnqueueRelevanceJob from '../../../src/map-data/sqs/tryEnqueueRelevanceJob';

jest.mock('../../../src/map-data/sqs/sendRelevanceSQSMessage', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../src/map-data/sqs/findRelevanceJobInDlq', () => ({
    __esModule: true,
    default: jest.fn(),
}));

const sendRelevanceSQSMessage = require('../../../src/map-data/sqs/sendRelevanceSQSMessage')
    .default as jest.MockedFunction<
    typeof import('../../../src/map-data/sqs/sendRelevanceSQSMessage').default
>;
const findRelevanceJobInDlq = require('../../../src/map-data/sqs/findRelevanceJobInDlq')
    .default as jest.MockedFunction<
    typeof import('../../../src/map-data/sqs/findRelevanceJobInDlq').default
>;

function job(overrides: Record<string, unknown> = {}) {
    return {
        id: 'job-1',
        mapDataId: 'map-1',
        pageId: 'page-1',
        pageSource: PageDataSource.Ropewiki,
        pageReady: true,
        errors: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        allowUpdates: true,
        ...overrides,
    } as any;
}

describe('tryEnqueueRelevanceJob', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        findRelevanceJobInDlq.mockResolvedValue(false);
        sendRelevanceSQSMessage.mockResolvedValue(undefined);
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('skips when mapDataId is null', async () => {
        await tryEnqueueRelevanceJob(job({ mapDataId: null }));
        expect(findRelevanceJobInDlq).not.toHaveBeenCalled();
        expect(sendRelevanceSQSMessage).not.toHaveBeenCalled();
    });

    it('skips when pageReady is false', async () => {
        await tryEnqueueRelevanceJob(job({ pageReady: false }));
        expect(findRelevanceJobInDlq).not.toHaveBeenCalled();
        expect(sendRelevanceSQSMessage).not.toHaveBeenCalled();
    });

    it('skips when the job id is already in the DLQ', async () => {
        findRelevanceJobInDlq.mockResolvedValue(true);
        await tryEnqueueRelevanceJob(job());
        expect(findRelevanceJobInDlq).toHaveBeenCalledWith('job-1');
        expect(sendRelevanceSQSMessage).not.toHaveBeenCalled();
    });

    it('sends an SQS message when the job is ready and not in the DLQ', async () => {
        await tryEnqueueRelevanceJob(job());
        expect(sendRelevanceSQSMessage).toHaveBeenCalledWith({
            id: 'job-1',
            mapDataId: 'map-1',
            pageId: 'page-1',
            pageSource: PageDataSource.Ropewiki,
        });
    });
});
