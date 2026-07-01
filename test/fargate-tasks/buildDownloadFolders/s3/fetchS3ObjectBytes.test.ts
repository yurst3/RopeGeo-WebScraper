import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockSend = jest.fn();

jest.mock('ropegeo-common/helpers', () => ({
    getS3Client: jest.fn(() => ({ send: mockSend })),
}));

import { fetchS3ObjectBytes } from '../../../../src/fargate-tasks/buildDownloadFolders/s3/fetchS3ObjectBytes';

describe('fetchS3ObjectBytes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns object bytes from S3', async () => {
        mockSend.mockResolvedValue({
            Body: {
                transformToByteArray: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
            },
        });

        await expect(fetchS3ObjectBytes('bucket', 'key/path')).resolves.toEqual(Buffer.from([1, 2, 3]));
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('throws when S3 object body is missing', async () => {
        mockSend.mockResolvedValue({ Body: null });

        await expect(fetchS3ObjectBytes('bucket', 'missing-key')).rejects.toThrow(
            'S3 object not found: s3://bucket/missing-key',
        );
    });
});
