import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PageDataSource } from 'ropegeo-common/models';
import { flipPageZipperImageDataReady } from '../../../src/image-data/util/flipPageZipperImageDataReady';
import PageZipperJob from '../../../src/page-zipper/types/pageZipperJob';

jest.mock('../../../src/page-zipper/database/upsertPageZipperJob', () => ({
    __esModule: true,
    upsertPageZipperJob: jest.fn(),
    default: jest.fn(),
    PageZipperJob: jest.requireActual('../../../src/page-zipper/types/pageZipperJob').default,
}));
jest.mock('../../../src/page-zipper/sqs/tryEnqueuePageZipperJob', () => ({
    __esModule: true,
    default: jest.fn(),
}));

const upsertPageZipperJob = require('../../../src/page-zipper/database/upsertPageZipperJob')
    .upsertPageZipperJob as jest.MockedFunction<
    typeof import('../../../src/page-zipper/database/upsertPageZipperJob').upsertPageZipperJob
>;
const tryEnqueuePageZipperJob = require('../../../src/page-zipper/sqs/tryEnqueuePageZipperJob')
    .default as jest.MockedFunction<
    typeof import('../../../src/page-zipper/sqs/tryEnqueuePageZipperJob').default
>;

function readyJob(): PageZipperJob {
    return new PageZipperJob(
        'job-1',
        'page-1',
        'ropewiki',
        true,
        false,
        null,
        { img: true },
        {},
        '2025-01-01T00:00:00' as PageZipperJob['createdAt'],
        '2025-01-01T00:00:00' as PageZipperJob['updatedAt'],
    );
}

describe('flipPageZipperImageDataReady', () => {
    const conn = {} as never;

    beforeEach(() => {
        jest.clearAllMocks();
        tryEnqueuePageZipperJob.mockResolvedValue(undefined);
    });

    it('flips via upsert and enqueues when ready', async () => {
        const job = readyJob();
        upsertPageZipperJob.mockResolvedValue(job);

        const result = await flipPageZipperImageDataReady(
            conn,
            'page-1',
            PageDataSource.Ropewiki,
            'img',
        );

        expect(upsertPageZipperJob).toHaveBeenCalledWith(
            conn,
            'page-1',
            PageDataSource.Ropewiki,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            'img',
        );
        expect(tryEnqueuePageZipperJob).toHaveBeenCalledWith(job);
        expect(result).toBe(job);
    });

    it('skips enqueue when upsert returns undefined', async () => {
        upsertPageZipperJob.mockResolvedValue(undefined);
        await flipPageZipperImageDataReady(conn, 'page-1', PageDataSource.Ropewiki, 'img');
        expect(tryEnqueuePageZipperJob).not.toHaveBeenCalled();
    });
});
