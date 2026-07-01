import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ImageVersion } from 'ropegeo-common/models';

jest.mock('../../../../src/fargate-tasks/buildDownloadFolders/s3/fetchS3ObjectBytes', () => ({
    fetchS3ObjectBytes: jest.fn(),
}));

import { appendImageEntriesToArchive } from '../../../../src/fargate-tasks/buildDownloadFolders/zip/appendImageEntriesToArchive';
import { fetchS3ObjectBytes } from '../../../../src/fargate-tasks/buildDownloadFolders/s3/fetchS3ObjectBytes';

describe('appendImageEntriesToArchive', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(fetchS3ObjectBytes).mockResolvedValue(Buffer.from('image-bytes'));
    });

    it('appends banner and full image entries from S3', async () => {
        const archive = { append: jest.fn() };
        const imageId = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee';
        const processedImageId = 'bbbbbbbb-cccc-4ddd-eeee-ffffffffffff';

        await appendImageEntriesToArchive(archive as never, 'image-bucket', [
            {
                imageId,
                processedImageId,
                bannerUrl: 'https://cdn.example.com/banner.avif',
                fullUrl: 'https://cdn.example.com/full.avif',
            },
        ]);

        expect(fetchS3ObjectBytes).toHaveBeenCalledTimes(2);
        expect(fetchS3ObjectBytes).toHaveBeenCalledWith(
            'image-bucket',
            `${processedImageId}/${ImageVersion.banner}.avif`,
        );
        expect(fetchS3ObjectBytes).toHaveBeenCalledWith(
            'image-bucket',
            `${processedImageId}/${ImageVersion.full}.avif`,
        );
        expect(archive.append).toHaveBeenCalledTimes(2);
    });

    it('skips image versions with no URL', async () => {
        const archive = { append: jest.fn() };

        await appendImageEntriesToArchive(archive as never, 'image-bucket', [
            {
                imageId: 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee',
                processedImageId: 'bbbbbbbb-cccc-4ddd-eeee-ffffffffffff',
                bannerUrl: null,
                fullUrl: null,
            },
        ]);

        expect(fetchS3ObjectBytes).not.toHaveBeenCalled();
        expect(archive.append).not.toHaveBeenCalled();
    });
});
