import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import listAllPbfKeysAndTotalBytes from '../../../../src/api/getMapdataTiles/s3/listAllPbfKeysAndTotalBytes';
import { listS3Objects } from 'ropegeo-common/helpers';

jest.mock('ropegeo-common/helpers', () => ({ __esModule: true, listS3Objects: jest.fn() }));

describe('listAllPbfKeysAndTotalBytes', () => {
    const mapDataId = '550e8400-e29b-41d4-a716-446655440000';
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        jest.clearAllMocks();
        originalEnv = process.env;
        process.env = { ...originalEnv, MAP_DATA_BUCKET_NAME: 'test-bucket' };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('filters to .pbf keys, sorts, and sums only pbf sizes', async () => {
        jest.mocked(listS3Objects).mockResolvedValue([
            { key: `tiles/${mapDataId}/1/1/1.pbf`, size: 100 },
            { key: `tiles/${mapDataId}/skip.txt`, size: 50 },
            { key: `tiles/${mapDataId}/0/0/0.pbf`, size: 200 },
        ]);

        const result = await listAllPbfKeysAndTotalBytes(mapDataId);

        expect(listS3Objects).toHaveBeenCalledWith('test-bucket', `tiles/${mapDataId}/`);
        expect(result.keys).toEqual([
            `tiles/${mapDataId}/0/0/0.pbf`,
            `tiles/${mapDataId}/1/1/1.pbf`,
        ]);
        expect(result.totalBytes).toBe(300);
    });

    it('throws when MAP_DATA_BUCKET_NAME is not set', async () => {
        delete process.env.MAP_DATA_BUCKET_NAME;

        await expect(listAllPbfKeysAndTotalBytes(mapDataId)).rejects.toThrow(
            'MAP_DATA_BUCKET_NAME environment variable is not set',
        );
        expect(listS3Objects).not.toHaveBeenCalled();
    });

    it('throws when MAP_DATA_BUCKET_NAME is empty string', async () => {
        process.env.MAP_DATA_BUCKET_NAME = '   ';

        await expect(listAllPbfKeysAndTotalBytes(mapDataId)).rejects.toThrow(
            'MAP_DATA_BUCKET_NAME environment variable is not set',
        );
        expect(listS3Objects).not.toHaveBeenCalled();
    });

    it('propagates errors from listS3Objects', async () => {
        jest.mocked(listS3Objects).mockRejectedValue(new Error('AccessDenied'));

        await expect(listAllPbfKeysAndTotalBytes(mapDataId)).rejects.toThrow('AccessDenied');
    });
});
