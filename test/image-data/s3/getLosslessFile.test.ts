import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import getLosslessFile from '../../../src/image-data/s3/getLosslessFile';
import { getS3Client } from '../../../src/helpers/s3/getS3Client';

jest.mock('../../../src/helpers/s3/getS3Client', () => ({
    getS3Client: jest.fn(),
}));

describe('getLosslessFile', () => {
    const imageDataId = '11111111-1111-1111-1111-111111111111';
    const mockSend = jest.fn();
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        jest.clearAllMocks();
        originalEnv = process.env;
        process.env = { ...originalEnv, IMAGE_BUCKET_NAME: 'test-bucket' };
        jest.mocked(getS3Client).mockReturnValue({ send: mockSend } as ReturnType<typeof getS3Client>);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('returns buffer when object exists', async () => {
        const bytes = new Uint8Array([1, 2, 3, 4]);
        mockSend.mockResolvedValue({
            Body: {
                transformToByteArray: async () => bytes,
            },
        });

        const result = await getLosslessFile(imageDataId);

        expect(result).toEqual(Buffer.from(bytes));
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('uses key {imageDataId}/lossless.avif', async () => {
        const bytes = new Uint8Array([0]);
        mockSend.mockResolvedValue({
            Body: { transformToByteArray: async () => bytes },
        });

        await getLosslessFile(imageDataId);

        const cmdArg = mockSend.mock.calls[0][0];
        expect(cmdArg.input.Bucket).toBe('test-bucket');
        expect(cmdArg.input.Key).toBe(`${imageDataId}/lossless.avif`);
    });

    it('returns null when Body is null', async () => {
        mockSend.mockResolvedValue({ Body: null });

        await expect(getLosslessFile(imageDataId)).resolves.toBeNull();
    });

    it('returns null on NoSuchKey', async () => {
        const noSuchKey = new Error('NoSuchKey');
        (noSuchKey as Error & { name: string }).name = 'NoSuchKey';
        mockSend.mockRejectedValue(noSuchKey);

        await expect(getLosslessFile(imageDataId)).resolves.toBeNull();
    });

    it('throws when IMAGE_BUCKET_NAME is not set', async () => {
        delete process.env.IMAGE_BUCKET_NAME;

        await expect(getLosslessFile(imageDataId)).rejects.toThrow(
            'IMAGE_BUCKET_NAME environment variable is not set',
        );
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('propagates non-NoSuchKey errors', async () => {
        mockSend.mockRejectedValue(new Error('AccessDenied'));

        await expect(getLosslessFile(imageDataId)).rejects.toThrow('AccessDenied');
    });
});
