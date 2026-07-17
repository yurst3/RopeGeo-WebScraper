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

    it('appends preview, banner, and full image entries from S3', async () => {
        const archive = { append: jest.fn() };
        const imageId = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee';
        const processedImageId = 'bbbbbbbb-cccc-4ddd-eeee-ffffffffffff';

        await appendImageEntriesToArchive(archive as never, 'image-bucket', [
            {
                imageId,
                processedImageId,
                previewUrl: 'https://cdn.example.com/preview.avif',
                bannerUrl: 'https://cdn.example.com/banner.avif',
                fullUrl: 'https://cdn.example.com/full.avif',
            },
        ]);

        expect(fetchS3ObjectBytes).toHaveBeenCalledTimes(3);
        expect(fetchS3ObjectBytes).toHaveBeenCalledWith(
            'image-bucket',
            `${processedImageId}/${ImageVersion.preview}.avif`,
        );
        expect(fetchS3ObjectBytes).toHaveBeenCalledWith(
            'image-bucket',
            `${processedImageId}/${ImageVersion.banner}.avif`,
        );
        expect(fetchS3ObjectBytes).toHaveBeenCalledWith(
            'image-bucket',
            `${processedImageId}/${ImageVersion.full}.avif`,
        );
        expect(archive.append).toHaveBeenCalledTimes(3);
        expect(archive.append).toHaveBeenCalledWith(Buffer.from('image-bytes'), {
            name: `images/${imageId}-preview.avif`,
            store: true,
        });
        expect(archive.append).toHaveBeenCalledWith(Buffer.from('image-bytes'), {
            name: `images/${imageId}-banner.avif`,
            store: true,
        });
        expect(archive.append).toHaveBeenCalledWith(Buffer.from('image-bytes'), {
            name: `images/${imageId}-full.avif`,
            store: true,
        });
    });

    it('skips image versions with no URL', async () => {
        const archive = { append: jest.fn() };

        await appendImageEntriesToArchive(archive as never, 'image-bucket', [
            {
                imageId: 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee',
                processedImageId: 'bbbbbbbb-cccc-4ddd-eeee-ffffffffffff',
                previewUrl: null,
                bannerUrl: null,
                fullUrl: null,
            },
        ]);

        expect(fetchS3ObjectBytes).not.toHaveBeenCalled();
        expect(archive.append).not.toHaveBeenCalled();
    });

    it('skips only the preview entry when previewUrl is null', async () => {
        const archive = { append: jest.fn() };
        const imageId = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee';
        const processedImageId = 'bbbbbbbb-cccc-4ddd-eeee-ffffffffffff';

        await appendImageEntriesToArchive(archive as never, 'image-bucket', [
            {
                imageId,
                processedImageId,
                previewUrl: null,
                bannerUrl: 'https://cdn.example.com/banner.avif',
                fullUrl: 'https://cdn.example.com/full.avif',
            },
        ]);

        expect(fetchS3ObjectBytes).toHaveBeenCalledTimes(2);
        expect(fetchS3ObjectBytes).not.toHaveBeenCalledWith(
            'image-bucket',
            `${processedImageId}/${ImageVersion.preview}.avif`,
        );
        expect(archive.append).toHaveBeenCalledTimes(2);
    });
});
