import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { deleteS3Object } from '../../../src/helpers/s3/deleteS3Object';
import { getS3Client } from '../../../src/helpers/s3/getS3Client';

const mockSend = jest.fn();

jest.mock('../../../src/helpers/s3/getS3Client', () => ({
    getS3Client: jest.fn(),
}));

describe('deleteS3Object', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(getS3Client).mockReturnValue({ send: mockSend } as ReturnType<typeof getS3Client>);
        mockSend.mockResolvedValue({});
    });

    it('sends DeleteObjectCommand with bucket and key', async () => {
        await deleteS3Object('my-bucket', 'trails/0/0/0.pbf');

        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledWith(
            expect.objectContaining({
                input: { Bucket: 'my-bucket', Key: 'trails/0/0/0.pbf' },
            })
        );
    });
});
