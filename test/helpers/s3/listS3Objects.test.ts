import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import listS3Objects from '../../../src/helpers/s3/listS3Objects';
import { getS3Client } from '../../../src/helpers/s3/getS3Client';

const mockSend = jest.fn();

jest.mock('../../../src/helpers/s3/getS3Client', () => ({
    getS3Client: jest.fn(),
}));

describe('listS3Objects', () => {
    const bucket = 'my-bucket';

    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(getS3Client).mockReturnValue({ send: mockSend } as ReturnType<typeof getS3Client>);
    });

    it('returns empty array when prefix has no objects', async () => {
        mockSend.mockResolvedValueOnce({ Contents: undefined, IsTruncated: false });

        const result = await listS3Objects(bucket, 'routeMarkers');

        expect(result).toEqual([]);
        expect(mockSend).toHaveBeenCalledWith(
            expect.objectContaining({
                input: expect.objectContaining({ Bucket: bucket, Prefix: 'routeMarkers/' }),
            }),
        );
    });

    it('returns entries from a single list page', async () => {
        mockSend.mockResolvedValueOnce({
            Contents: [
                { Key: 'trails/0/0/0.pbf', Size: 100 },
                { Key: 'trails/1/0/0.pbf', Size: 200 },
            ],
            IsTruncated: false,
        });

        const result = await listS3Objects(bucket, 'trails');

        expect(result).toEqual([
            { key: 'trails/0/0/0.pbf', size: 100 },
            { key: 'trails/1/0/0.pbf', size: 200 },
        ]);
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('treats missing Size as 0', async () => {
        mockSend.mockResolvedValueOnce({
            Contents: [{ Key: 'a/b' }],
            IsTruncated: false,
        });

        const result = await listS3Objects(bucket, 'a');

        expect(result).toEqual([{ key: 'a/b', size: 0 }]);
    });

    it('paginates and concatenates entries', async () => {
        mockSend
            .mockResolvedValueOnce({
                Contents: [
                    { Key: 'p/0.pbf', Size: 10 },
                    { Key: 'p/1.pbf', Size: 20 },
                ],
                IsTruncated: true,
                NextContinuationToken: 'next',
            })
            .mockResolvedValueOnce({
                Contents: [{ Key: 'p/2.pbf', Size: 5 }],
                IsTruncated: false,
            });

        const result = await listS3Objects(bucket, 'p');

        expect(result).toEqual([
            { key: 'p/0.pbf', size: 10 },
            { key: 'p/1.pbf', size: 20 },
            { key: 'p/2.pbf', size: 5 },
        ]);
        expect(mockSend).toHaveBeenCalledTimes(2);
        expect(mockSend).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                input: expect.objectContaining({ ContinuationToken: 'next' }),
            }),
        );
    });

    it('normalizes prefix with trailing slash', async () => {
        mockSend.mockResolvedValueOnce({ Contents: [], IsTruncated: false });

        await listS3Objects(bucket, 'routeMarkers/');

        expect(mockSend).toHaveBeenCalledWith(
            expect.objectContaining({
                input: expect.objectContaining({ Prefix: 'routeMarkers/' }),
            }),
        );
    });

    it('skips objects with null Key', async () => {
        mockSend.mockResolvedValueOnce({
            Contents: [{ Key: 'ok', Size: 1 }, { Key: null, Size: 99 }],
            IsTruncated: false,
        });

        const result = await listS3Objects(bucket, 'x');

        expect(result).toEqual([{ key: 'ok', size: 1 }]);
    });
});
