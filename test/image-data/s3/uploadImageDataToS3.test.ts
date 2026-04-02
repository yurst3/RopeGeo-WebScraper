import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import uploadImageDataToS3, { buildImagePublicUrl } from '../../../src/image-data/s3/uploadImageDataToS3';

jest.mock('ropegeo-common/helpers', () => ({
    __esModule: true,
    putS3Object: jest.fn(),
}));

const mockPutS3Object = require('ropegeo-common/helpers').putS3Object as jest.Mock;

describe('uploadImageDataToS3', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        process.env.IMAGE_BUCKET_NAME = 'my-image-bucket';
        mockPutS3Object.mockResolvedValue('https://my-image-bucket.s3.amazonaws.com/key');
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('buildImagePublicUrl', () => {
        it('returns CloudFront-style URL when IMAGE_PUBLIC_BASE_URL is set', () => {
            process.env.IMAGE_PUBLIC_BASE_URL = 'https://cdn.example.com';
            expect(buildImagePublicUrl('bucket', 'id/preview.avif')).toBe(
                'https://cdn.example.com/images/id/preview.avif',
            );
        });

        it('strips trailing slash from base URL', () => {
            process.env.IMAGE_PUBLIC_BASE_URL = 'https://cdn.example.com/';
            expect(buildImagePublicUrl('bucket', 'id/banner.avif')).toBe(
                'https://cdn.example.com/images/id/banner.avif',
            );
        });

        it('returns S3 URL when IMAGE_PUBLIC_BASE_URL is not set', () => {
            delete process.env.IMAGE_PUBLIC_BASE_URL;
            expect(buildImagePublicUrl('my-bucket', 'id/full.avif')).toBe(
                'https://my-bucket.s3.amazonaws.com/id/full.avif',
            );
        });
    });

    it('throws when IMAGE_BUCKET_NAME is not set', async () => {
        delete process.env.IMAGE_BUCKET_NAME;
        await expect(uploadImageDataToS3('key', Buffer.from('x'))).rejects.toThrow(
            'IMAGE_BUCKET_NAME environment variable is not set',
        );
        expect(mockPutS3Object).not.toHaveBeenCalled();
    });

    it('uploads and returns URL on success', async () => {
        const url = await uploadImageDataToS3('id/preview.avif', Buffer.from('body'));
        expect(mockPutS3Object).toHaveBeenCalledWith(
            'my-image-bucket',
            'id/preview.avif',
            Buffer.from('body'),
            'image/avif',
        );
        expect(url).toBe('https://my-image-bucket.s3.amazonaws.com/id/preview.avif');
    });

    it('returns CloudFront URL when IMAGE_PUBLIC_BASE_URL is set', async () => {
        process.env.IMAGE_PUBLIC_BASE_URL = 'https://cdn.example.com';
        const url = await uploadImageDataToS3('id/banner.avif', Buffer.from('x'));
        expect(url).toBe('https://cdn.example.com/images/id/banner.avif');
    });

    it('throws on upload failure when uploadErrors is not provided', async () => {
        mockPutS3Object.mockRejectedValue(new Error('S3 error'));
        await expect(uploadImageDataToS3('key', Buffer.from('x'))).rejects.toThrow('S3 error');
    });

    it('pushes to uploadErrors and returns undefined on failure when uploadErrors is provided', async () => {
        mockPutS3Object.mockRejectedValue(new Error('S3 error'));
        const uploadErrors: string[] = [];
        const url = await uploadImageDataToS3('id/preview.avif', Buffer.from('x'), undefined, uploadErrors);
        expect(url).toBeUndefined();
        expect(uploadErrors).toEqual(['id/preview.avif: S3 error']);
    });

    it('accepts custom contentType', async () => {
        await uploadImageDataToS3('key', Buffer.from('x'), 'image/png');
        expect(mockPutS3Object).toHaveBeenCalledWith('my-image-bucket', 'key', expect.any(Buffer), 'image/png');
    });
});
