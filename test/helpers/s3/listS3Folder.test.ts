import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { listS3Folder } from '../../../src/helpers/s3/listS3Folder';
import { getS3Client } from '../../../src/helpers/s3/getS3Client';

const mockSend = jest.fn();

jest.mock('../../../src/helpers/s3/getS3Client', () => ({
    getS3Client: jest.fn(),
}));

describe('listS3Folder', () => {
    const bucket = 'my-bucket';

    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(getS3Client).mockReturnValue({ send: mockSend } as ReturnType<typeof getS3Client>);
    });

    it('returns empty array when prefix has no objects', async () => {
        mockSend.mockResolvedValueOnce({ Contents: undefined, IsTruncated: false });

        const result = await listS3Folder(bucket, 'routeMarkers');

        expect(result).toEqual([]);
        expect(mockSend).toHaveBeenCalledWith(
            expect.objectContaining({
                input: expect.objectContaining({ Bucket: bucket, Prefix: 'routeMarkers/' }),
            })
        );
    });

    it('returns all keys from a single list page', async () => {
        mockSend.mockResolvedValueOnce({
            Contents: [
                { Key: 'trails/0/0/0.pbf' },
                { Key: 'trails/1/0/0.pbf' },
            ],
            IsTruncated: false,
        });

        const result = await listS3Folder(bucket, 'trails');

        expect(result).toEqual(['trails/0/0/0.pbf', 'trails/1/0/0.pbf']);
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('paginates and returns all keys', async () => {
        mockSend
            .mockResolvedValueOnce({
                Contents: [{ Key: 'p/0.pbf' }, { Key: 'p/1.pbf' }],
                IsTruncated: true,
                NextContinuationToken: 'next',
            })
            .mockResolvedValueOnce({
                Contents: [{ Key: 'p/2.pbf' }],
                IsTruncated: false,
            });

        const result = await listS3Folder(bucket, 'p');

        expect(result).toEqual(['p/0.pbf', 'p/1.pbf', 'p/2.pbf']);
        expect(mockSend).toHaveBeenCalledTimes(2);
        expect(mockSend).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                input: expect.objectContaining({ ContinuationToken: 'next' }),
            })
        );
    });

    it('normalizes prefix with trailing slash', async () => {
        mockSend.mockResolvedValueOnce({ Contents: [], IsTruncated: false });

        await listS3Folder(bucket, 'routeMarkers/');

        expect(mockSend).toHaveBeenCalledWith(
            expect.objectContaining({
                input: expect.objectContaining({ Prefix: 'routeMarkers/' }),
            })
        );
    });
});
