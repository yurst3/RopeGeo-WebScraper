import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import tryEnqueuePageZipperJob from '../../../src/page-zipper/sqs/tryEnqueuePageZipperJob';
import PageZipperJob from '../../../src/page-zipper/types/pageZipperJob';

jest.mock('../../../src/page-zipper/sqs/sendPageZipperSQSMessage', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../src/page-zipper/sqs/findPageZipperJobInDlq', () => ({
    __esModule: true,
    default: jest.fn(),
}));

const sendPageZipperSQSMessage = require('../../../src/page-zipper/sqs/sendPageZipperSQSMessage')
    .default as jest.MockedFunction<
    typeof import('../../../src/page-zipper/sqs/sendPageZipperSQSMessage').default
>;
const findPageZipperJobInDlq = require('../../../src/page-zipper/sqs/findPageZipperJobInDlq')
    .default as jest.MockedFunction<
    typeof import('../../../src/page-zipper/sqs/findPageZipperJobInDlq').default
>;

function makeJob(): PageZipperJob {
    return new PageZipperJob(
        'job-1',
        'page-1',
        'ropewiki',
        true,
        false,
        null,
        {},
        null,
        '2025-01-01T00:00:00' as PageZipperJob['createdAt'],
        '2025-01-01T00:00:00' as PageZipperJob['updatedAt'],
    );
}

describe('tryEnqueuePageZipperJob', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        findPageZipperJobInDlq.mockResolvedValue(false);
        sendPageZipperSQSMessage.mockResolvedValue(undefined);
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('skips send when the job id is already in the DLQ', async () => {
        findPageZipperJobInDlq.mockResolvedValue(true);
        await tryEnqueuePageZipperJob(makeJob());
        expect(findPageZipperJobInDlq).toHaveBeenCalledWith('job-1');
        expect(sendPageZipperSQSMessage).not.toHaveBeenCalled();
    });

    it('sends toMessage() when the job is not in the DLQ', async () => {
        const job = makeJob();
        await tryEnqueuePageZipperJob(job);
        expect(sendPageZipperSQSMessage).toHaveBeenCalledWith(job.toMessage());
    });
});
