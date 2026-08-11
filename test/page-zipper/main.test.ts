import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PageDataSource } from 'ropegeo-common/models';
import { main } from '../../src/page-zipper/main';
import PageZipperJobEvent from '../../src/page-zipper/types/pageZipperJobEvent';
import PageZipperJob from '../../src/page-zipper/types/pageZipperJob';

jest.mock('../../src/page-zipper/database/getPageZipperJobById', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../src/page-zipper/readiness/isRopewikiPageReadyForFolder', () => ({
    isRopewikiPageReadyForFolder: jest.fn(),
}));
jest.mock('../../src/page-zipper/processors/processFolderForPage', () => ({
    processFolderForPage: jest.fn(),
}));
jest.mock('../../src/page-zipper/database/deletePageZipperJob', () => ({
    __esModule: true,
    default: jest.fn(),
}));

const getPageZipperJobById = require('../../src/page-zipper/database/getPageZipperJobById')
    .default as jest.MockedFunction<
    typeof import('../../src/page-zipper/database/getPageZipperJobById').default
>;
const { isRopewikiPageReadyForFolder } = require('../../src/page-zipper/readiness/isRopewikiPageReadyForFolder') as {
    isRopewikiPageReadyForFolder: jest.MockedFunction<
        typeof import('../../src/page-zipper/readiness/isRopewikiPageReadyForFolder').isRopewikiPageReadyForFolder
    >;
};
const { processFolderForPage } = require('../../src/page-zipper/processors/processFolderForPage') as {
    processFolderForPage: jest.MockedFunction<
        typeof import('../../src/page-zipper/processors/processFolderForPage').processFolderForPage
    >;
};
const deletePageZipperJob = require('../../src/page-zipper/database/deletePageZipperJob')
    .default as jest.MockedFunction<
    typeof import('../../src/page-zipper/database/deletePageZipperJob').default
>;

describe('page-zipper main', () => {
    const client = {} as never;
    const event = new PageZipperJobEvent('job-1', 'page-1', PageDataSource.Ropewiki);

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
        getPageZipperJobById.mockResolvedValue(
            new PageZipperJob(
                'job-1',
                'page-1',
                'ropewiki',
                true,
                false,
                null,
                {},
                {},
                '2025-01-01T00:00:00' as PageZipperJob['createdAt'],
                '2025-01-01T00:00:00' as PageZipperJob['updatedAt'],
            ),
        );
        isRopewikiPageReadyForFolder.mockResolvedValue(true);
        processFolderForPage.mockResolvedValue(undefined);
        deletePageZipperJob.mockResolvedValue(undefined);
    });

    it('returns missing_job when the PageZipperJob row is gone', async () => {
        getPageZipperJobById.mockResolvedValue(undefined);
        await expect(main(event, client)).resolves.toEqual({ status: 'missing_job' });
        expect(processFolderForPage).not.toHaveBeenCalled();
    });

    it('returns not_ready when the defensive readiness check fails', async () => {
        isRopewikiPageReadyForFolder.mockResolvedValue(false);
        await expect(main(event, client)).resolves.toEqual({ status: 'not_ready' });
        expect(processFolderForPage).not.toHaveBeenCalled();
        expect(deletePageZipperJob).not.toHaveBeenCalled();
    });

    it('zips, deletes the job, and returns complete when ready', async () => {
        await expect(main(event, client)).resolves.toEqual({ status: 'complete' });
        expect(processFolderForPage).toHaveBeenCalled();
        expect(deletePageZipperJob).toHaveBeenCalledWith(client, 'job-1');
    });

    it('throws for unsupported pageSource', async () => {
        const unsupported = new PageZipperJobEvent(
            'job-1',
            'page-1',
            'other' as PageDataSource,
        );
        await expect(main(unsupported, client)).rejects.toThrow(/unsupported pageSource/);
    });
});
