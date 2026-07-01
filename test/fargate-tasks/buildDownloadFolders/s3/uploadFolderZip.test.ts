import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

jest.mock('fs/promises', () => ({
    readFile: jest.fn(),
}));
jest.mock('ropegeo-common/helpers', () => ({
    putS3Object: jest.fn(),
}));

import { readFile } from 'fs/promises';
import { putS3Object } from 'ropegeo-common/helpers';
import { uploadFolderZip } from '../../../../src/fargate-tasks/buildDownloadFolders/s3/uploadFolderZip';

describe('uploadFolderZip', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        jest.clearAllMocks();
        originalEnv = process.env;
        process.env = {
            ...originalEnv,
            PAGE_ZIP_BUCKET_NAME: 'test-page-zip-bucket',
        };
        jest.mocked(readFile).mockResolvedValue(Buffer.from('zip-bytes'));
        jest.mocked(putS3Object).mockResolvedValue(undefined);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('reads the zip file and uploads it to the page zip bucket', async () => {
        await uploadFolderZip('page.zip', '/tmp/page.zip');

        expect(readFile).toHaveBeenCalledWith('/tmp/page.zip');
        expect(putS3Object).toHaveBeenCalledWith(
            'test-page-zip-bucket',
            'page.zip',
            Buffer.from('zip-bytes'),
            'application/zip',
        );
    });
});
