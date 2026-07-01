import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

jest.mock('../../../../src/fargate-tasks/buildDownloadFolders/zip/writeZipToFile', () => ({
    writeZipToFile: jest.fn(),
}));
jest.mock('ropegeo-common/helpers', () => ({
    ...jest.requireActual<typeof import('ropegeo-common/helpers')>('ropegeo-common/helpers'),
    putS3Object: jest.fn(),
}));

import { persistFolderZip } from '../../../../src/fargate-tasks/buildDownloadFolders/processors/persistFolderZip';
import { writeZipToFile } from '../../../../src/fargate-tasks/buildDownloadFolders/zip/writeZipToFile';
import { putS3Object } from 'ropegeo-common/helpers';

const mockConn = {};
const pageId = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee';
const regionId = 'bbbbbbbb-cccc-4ddd-eeee-ffffffffffff';
const mockUpdateFolderForPage = jest.fn(() => Promise.resolve());

describe('persistFolderZip', () => {
    let originalEnv: NodeJS.ProcessEnv;
    const mockView = {
        id: pageId,
        fetchType: 'online',
        bannerImage: null,
        betaSections: [],
    };

    beforeEach(() => {
        jest.clearAllMocks();
        originalEnv = process.env;
        process.env = {
            ...originalEnv,
            DEV_ENVIRONMENT: 'production',
            PAGE_ZIP_BUCKET_NAME: 'test-page-zip-bucket',
            PAGE_ZIP_PUBLIC_BASE_URL: 'https://cdn.example.com/page-zips',
            MAP_DATA_BUCKET_NAME: 'test-map-data-bucket',
            IMAGE_BUCKET_NAME: 'test-image-bucket',
        };
        jest.mocked(writeZipToFile).mockResolvedValue(undefined);
        mockUpdateFolderForPage.mockResolvedValue(undefined);
        jest.mocked(putS3Object).mockResolvedValue(undefined);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('uploads ZIP to S3 and updates downloadFolder in production', async () => {
        const readFileSpy = jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValue(Buffer.from('zip'));

        await persistFolderZip(
            mockConn,
            pageId,
            regionId,
            mockView as never,
            [],
            mockUpdateFolderForPage,
        );

        expect(writeZipToFile).toHaveBeenCalledWith(
            `/tmp/${pageId}.zip`,
            expect.any(Function),
        );
        expect(putS3Object).toHaveBeenCalledWith(
            'test-page-zip-bucket',
            `${pageId}.zip`,
            expect.any(Buffer),
            'application/zip',
        );
        expect(mockUpdateFolderForPage).toHaveBeenCalledWith(mockConn, pageId);
        readFileSpy.mockRestore();
    });

    it('writes local ZIP when DEV_ENVIRONMENT is local', async () => {
        process.env.DEV_ENVIRONMENT = 'local';

        await persistFolderZip(
            mockConn,
            pageId,
            regionId,
            mockView as never,
            [],
            mockUpdateFolderForPage,
        );

        expect(writeZipToFile).toHaveBeenCalledWith(
            `.savedDownloadFolders/${pageId}.zip`,
            expect.any(Function),
        );
        expect(putS3Object).not.toHaveBeenCalled();
        expect(mockUpdateFolderForPage).toHaveBeenCalledWith(mockConn, pageId);
    });
});
