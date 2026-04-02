import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ImageVersion } from 'ropegeo-common/classes';
import {
    lambdaSaveImageData,
    nodeSaveImageData,
} from '../../../src/image-data/hook-functions/saveImageData';
import ImageData from '../../../src/image-data/types/imageData';
import { Metadata } from '../../../src/image-data/types/metadata';
import { ProgressLogger } from 'ropegeo-common/helpers';

jest.mock('fs/promises', () => ({
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/image-data/s3/uploadImageDataToS3', () => ({
    __esModule: true,
    default: jest.fn(),
    buildImagePublicUrl: jest.fn((bucket: string, key: string) => `https://${bucket}.s3.amazonaws.com/${key}`),
}));

const mockUploadImageDataToS3 = require('../../../src/image-data/s3/uploadImageDataToS3').default as jest.Mock;
const mockBuildImagePublicUrl = require('../../../src/image-data/s3/uploadImageDataToS3').buildImagePublicUrl as jest.Mock;

describe('saveImageData', () => {
    const imageDataId = '11111111-1111-1111-1111-111111111111';
    const sourceUrl = 'https://example.com/source.jpg';
    const previewBuffer = Buffer.from('preview');
    const bannerBuffer = Buffer.from('banner');
    const fullBuffer = Buffer.from('full');
    const losslessBuffer = Buffer.from('lossless');
    const linkPreviewBuffer = Buffer.from('link');
    const metadata = new Metadata();
    const buffers = {
        [ImageVersion.preview]: previewBuffer,
        [ImageVersion.linkPreview]: linkPreviewBuffer,
        [ImageVersion.banner]: bannerBuffer,
        [ImageVersion.full]: fullBuffer,
        [ImageVersion.lossless]: losslessBuffer,
    };
    let logger: ProgressLogger;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.IMAGE_BUCKET_NAME = 'image-bucket';
        mockBuildImagePublicUrl.mockImplementation((bucket: string, key: string) =>
            `https://${bucket}.s3.amazonaws.com/${key}`,
        );
        logger = {
            logProgress: jest.fn(),
            logError: jest.fn(),
        } as unknown as ProgressLogger;
    });

    describe('lambdaSaveImageData', () => {
        it('throws when IMAGE_BUCKET_NAME is not set', async () => {
            delete process.env.IMAGE_BUCKET_NAME;
            await expect(
                lambdaSaveImageData(imageDataId, sourceUrl, buffers, metadata, logger),
            ).rejects.toThrow('IMAGE_BUCKET_NAME environment variable is not set');
            expect(mockUploadImageDataToS3).not.toHaveBeenCalled();
        });

        it('when local, skips upload and returns ImageData with placeholder URLs', async () => {
            process.env.DEV_ENVIRONMENT = 'local';
            const result = await lambdaSaveImageData(imageDataId, sourceUrl, buffers, metadata, logger);
            expect(logger.logProgress).toHaveBeenCalledWith(`Skipping S3 upload for image data ${imageDataId} (local)`);
            expect(mockUploadImageDataToS3).not.toHaveBeenCalled();
            expect(result).toBeInstanceOf(ImageData);
            expect(result.id).toBe(imageDataId);
            expect(result.sourceUrl).toBe(sourceUrl);
            expect(result.previewUrl).toContain('/preview.avif');
            expect(result.linkPreviewUrl).toContain('/linkPreview.jpg');
            expect(result.bannerUrl).toContain('/banner.avif');
            expect(result.fullUrl).toContain('/full.avif');
            expect(result.losslessUrl).toContain('/lossless.avif');
            expect(result.errorMessage).toBeUndefined();
        });

        it('when not local, uploads all variants and returns ImageData with URLs', async () => {
            delete process.env.DEV_ENVIRONMENT;
            mockUploadImageDataToS3
                .mockResolvedValueOnce('https://bucket.s3.amazonaws.com/id/preview.avif')
                .mockResolvedValueOnce('https://bucket.s3.amazonaws.com/id/linkPreview.jpg')
                .mockResolvedValueOnce('https://bucket.s3.amazonaws.com/id/banner.avif')
                .mockResolvedValueOnce('https://bucket.s3.amazonaws.com/id/full.avif')
                .mockResolvedValueOnce('https://bucket.s3.amazonaws.com/id/lossless.avif');
            const result = await lambdaSaveImageData(imageDataId, sourceUrl, buffers, metadata, logger);
            expect(mockUploadImageDataToS3).toHaveBeenCalledTimes(5);
            expect(mockUploadImageDataToS3).toHaveBeenNthCalledWith(
                1,
                `${imageDataId}/preview.avif`,
                previewBuffer,
                'image/avif',
                expect.any(Array),
            );
            expect(mockUploadImageDataToS3).toHaveBeenNthCalledWith(
                2,
                `${imageDataId}/linkPreview.jpg`,
                linkPreviewBuffer,
                'image/jpeg',
                expect.any(Array),
            );
            expect(result.previewUrl).toBe('https://bucket.s3.amazonaws.com/id/preview.avif');
            expect(result.linkPreviewUrl).toBe('https://bucket.s3.amazonaws.com/id/linkPreview.jpg');
            expect(result.bannerUrl).toBe('https://bucket.s3.amazonaws.com/id/banner.avif');
            expect(result.fullUrl).toBe('https://bucket.s3.amazonaws.com/id/full.avif');
            expect(result.losslessUrl).toBe('https://bucket.s3.amazonaws.com/id/lossless.avif');
            expect(result.errorMessage).toBeUndefined();
            expect(logger.logProgress).toHaveBeenCalledWith(`Image data ${imageDataId} uploaded successfully`);
        });

        it('when upload fails, returns ImageData with errorMessage and logs', async () => {
            delete process.env.DEV_ENVIRONMENT;
            mockUploadImageDataToS3.mockImplementation((key: string, _body: unknown, _ct: unknown, errors?: string[]) => {
                if (errors) errors.push(key);
                return Promise.resolve(undefined);
            });
            const result = await lambdaSaveImageData(imageDataId, sourceUrl, buffers, metadata, logger);
            expect(result.previewUrl).toBeUndefined();
            expect(result.linkPreviewUrl).toBeUndefined();
            expect(result.bannerUrl).toBeUndefined();
            expect(result.fullUrl).toBeUndefined();
            expect(result.losslessUrl).toBeUndefined();
            expect(result.errorMessage).toContain('preview.avif');
            expect(result.errorMessage).toContain('linkPreview.jpg');
            expect(logger.logError).toHaveBeenCalledWith(`Image data ${imageDataId}: ${result.errorMessage}`);
        });
    });

    describe('nodeSaveImageData', () => {
        it('writes files and returns ImageData with file:// URLs', async () => {
            const result = await nodeSaveImageData(imageDataId, sourceUrl, buffers, metadata, logger);
            expect(result).toBeInstanceOf(ImageData);
            expect(result.id).toBe(imageDataId);
            expect(result.sourceUrl).toBe(sourceUrl);
            expect(result.previewUrl).toMatch(/^file:\/\//);
            expect(result.previewUrl).toContain('preview.avif');
            expect(result.linkPreviewUrl).toMatch(/^file:\/\//);
            expect(result.linkPreviewUrl).toContain('linkPreview.jpg');
            expect(result.bannerUrl).toMatch(/^file:\/\//);
            expect(result.fullUrl).toMatch(/^file:\/\//);
            expect(result.losslessUrl).toMatch(/^file:\/\//);
            expect(result.errorMessage).toBeUndefined();
            expect(logger.logProgress).toHaveBeenCalledWith(expect.stringContaining('saved to'));
        });
    });
});
