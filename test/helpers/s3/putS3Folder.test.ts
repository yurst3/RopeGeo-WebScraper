import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { putS3Folder } from '../../../src/helpers/s3/putS3Folder';
import putS3Object from '../../../src/helpers/s3/putS3Object';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const mockLogProgress = jest.fn();
const mockLogError = jest.fn();
const mockGetResults = jest.fn().mockReturnValue({ successes: 0, errors: 0, remaining: 0 });

jest.mock('../../../src/helpers/s3/putS3Object', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../src/helpers/progressLogger', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        logProgress: mockLogProgress,
        logError: mockLogError,
        getResults: mockGetResults,
    })),
}));
jest.mock('fs', () => ({
    readdirSync: jest.fn(),
    readFileSync: jest.fn(),
}));

describe('putS3Folder', () => {
    const inFolder = '/tmp/tiles';
    const keyPrefix = 'trails';
    const bucket = 'my-bucket';
    const contentType = 'application/x-protobuf';

    beforeEach(() => {
        jest.mocked(readdirSync).mockClear();
        jest.mocked(readFileSync).mockClear();
        jest.mocked(putS3Object).mockClear();
        jest.mocked(putS3Object).mockResolvedValue('https://my-bucket.s3.amazonaws.com/key');
        mockLogProgress.mockClear();
        mockLogError.mockClear();
        mockGetResults.mockClear();
        mockGetResults.mockReturnValue({ successes: 0, errors: 0, remaining: 0 });
    });

    it('uploads all files under inFolder to S3 with keyPrefix and contentType', async () => {
        // Simulate structure: /tmp/tiles/0/0/0.pbf and 1/0/0.pbf
        jest.mocked(readdirSync)
            .mockReturnValueOnce([{ name: '0', isDirectory: () => true }, { name: '1', isDirectory: () => true }] as unknown as ReturnType<typeof readdirSync>)
            .mockReturnValueOnce([{ name: '0', isDirectory: () => true }] as unknown as ReturnType<typeof readdirSync>)
            .mockReturnValueOnce([{ name: '0.pbf', isDirectory: () => false }] as unknown as ReturnType<typeof readdirSync>)
            .mockReturnValueOnce([{ name: '0', isDirectory: () => true }] as unknown as ReturnType<typeof readdirSync>)
            .mockReturnValueOnce([{ name: '0.pbf', isDirectory: () => false }] as unknown as ReturnType<typeof readdirSync>);
        jest.mocked(readFileSync).mockReturnValue(Buffer.from('pbf-content'));

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        mockGetResults.mockReturnValue({ successes: 2, errors: 0, remaining: 0 });

        const result = await putS3Folder(inFolder, keyPrefix, bucket, contentType);

        expect(putS3Object).toHaveBeenCalledTimes(2);
        expect(putS3Object).toHaveBeenCalledWith(bucket, 'trails/0/0/0.pbf', Buffer.from('pbf-content'), contentType);
        expect(putS3Object).toHaveBeenCalledWith(bucket, 'trails/1/0/0.pbf', Buffer.from('pbf-content'), contentType);
        expect(result).toHaveLength(2);
        expect(result).toContain('trails/0/0/0.pbf');
        expect(result).toContain('trails/1/0/0.pbf');
        expect(mockLogProgress).toHaveBeenCalledTimes(2);
        expect(mockLogProgress).toHaveBeenCalledWith('0/0/0.pbf');
        expect(mockLogProgress).toHaveBeenCalledWith('1/0/0.pbf');
        expect(mockLogError).not.toHaveBeenCalled();
        expect(mockGetResults).toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith('Upload complete: 2 success(es), 0 error(s) to s3://my-bucket/trails/');
        consoleSpy.mockRestore();
    });

    it('strips trailing slash from keyPrefix', async () => {
        jest.mocked(readdirSync).mockReturnValueOnce([{ name: 'file.pbf', isDirectory: () => false }] as unknown as ReturnType<typeof readdirSync>);
        jest.mocked(readFileSync).mockReturnValue(Buffer.from('x'));
        mockGetResults.mockReturnValue({ successes: 1, errors: 0, remaining: 0 });
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        const result = await putS3Folder(inFolder, 'trails/', bucket, contentType);

        expect(putS3Object).toHaveBeenCalledWith(bucket, 'trails/file.pbf', expect.any(Buffer), contentType);
        expect(result).toEqual(['trails/file.pbf']);
        expect(mockLogProgress).toHaveBeenCalledWith('file.pbf');
        consoleSpy.mockRestore();
    });

    it('uploads single file with correct key', async () => {
        jest.mocked(readdirSync).mockReturnValueOnce([{ name: 'root.txt', isDirectory: () => false }] as unknown as ReturnType<typeof readdirSync>);
        jest.mocked(readFileSync).mockReturnValue(Buffer.from('content'));
        mockGetResults.mockReturnValue({ successes: 1, errors: 0, remaining: 0 });
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        const result = await putS3Folder(inFolder, 'myPrefix', bucket, 'text/plain');

        expect(readFileSync).toHaveBeenCalledWith(join(inFolder, 'root.txt'));
        expect(putS3Object).toHaveBeenCalledWith(bucket, 'myPrefix/root.txt', Buffer.from('content'), 'text/plain');
        expect(result).toEqual(['myPrefix/root.txt']);
        expect(mockLogProgress).toHaveBeenCalledWith('root.txt');
        consoleSpy.mockRestore();
    });

    it('logs errors via ProgressLogger when putS3Object rejects but returns all file paths', async () => {
        jest.mocked(readdirSync).mockReturnValueOnce([{ name: 'a.pbf', isDirectory: () => false }, { name: 'b.pbf', isDirectory: () => false }] as unknown as ReturnType<typeof readdirSync>);
        jest.mocked(readFileSync).mockReturnValue(Buffer.from('x'));
        jest.mocked(putS3Object)
            .mockRejectedValueOnce(new Error('S3 throttled'))
            .mockResolvedValueOnce('https://my-bucket.s3.amazonaws.com/key');
        mockGetResults.mockReturnValue({ successes: 1, errors: 1, remaining: 0 });
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        const result = await putS3Folder(inFolder, keyPrefix, bucket, contentType);

        expect(mockLogProgress).toHaveBeenCalledTimes(1);
        expect(mockLogProgress).toHaveBeenCalledWith('b.pbf');
        expect(mockLogError).toHaveBeenCalledTimes(1);
        expect(mockLogError).toHaveBeenCalledWith('a.pbf: S3 throttled');
        expect(result).toEqual(['trails/a.pbf', 'trails/b.pbf']);
        expect(consoleSpy).toHaveBeenCalledWith('Upload complete: 1 success(es), 1 error(s) to s3://my-bucket/trails/');
        consoleSpy.mockRestore();
    });
});
