import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { replaceS3Folder } from '../../../src/helpers/s3/replaceS3Folder';
import { deleteS3Object } from '../../../src/helpers/s3/deleteS3Object';
import { listS3Folder } from '../../../src/helpers/s3/listS3Folder';
import { putS3Folder } from '../../../src/helpers/s3/putS3Folder';

const mockLogProgress = jest.fn();
const mockLogError = jest.fn();
const mockGetResults = jest.fn().mockReturnValue({ successes: 0, errors: 0, remaining: 0 });

jest.mock('../../../src/helpers/s3/deleteS3Object', () => ({ deleteS3Object: jest.fn() }));
jest.mock('../../../src/helpers/s3/listS3Folder', () => ({ listS3Folder: jest.fn() }));
jest.mock('../../../src/helpers/s3/putS3Folder', () => ({ putS3Folder: jest.fn() }));
jest.mock('../../../src/helpers/progressLogger', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        logProgress: mockLogProgress,
        logError: mockLogError,
        getResults: mockGetResults,
    })),
}));

describe('replaceS3Folder', () => {
    const inFolder = '/tmp/tiles';
    const keyPrefix = 'trails';
    const bucket = 'my-bucket';
    const contentType = 'application/x-protobuf';

    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(listS3Folder).mockResolvedValue([]);
        jest.mocked(putS3Folder).mockResolvedValue([]);
        mockLogProgress.mockClear();
        mockLogError.mockClear();
        mockGetResults.mockClear();
        mockGetResults.mockReturnValue({ successes: 0, errors: 0, remaining: 0 });
    });

    it('lists existing, uploads, and does not delete when no existing keys', async () => {
        jest.mocked(putS3Folder).mockResolvedValue(['trails/0/0/0.pbf', 'trails/1/0/0.pbf']);

        await replaceS3Folder(inFolder, keyPrefix, bucket, contentType);

        expect(listS3Folder).toHaveBeenCalledWith(bucket, keyPrefix);
        expect(putS3Folder).toHaveBeenCalledWith(inFolder, keyPrefix, bucket, contentType);
        expect(deleteS3Object).not.toHaveBeenCalled();
        expect(mockLogProgress).not.toHaveBeenCalled();
    });

    it('deletes existing keys that were not in the upload set and logs progress', async () => {
        jest.mocked(listS3Folder).mockResolvedValue([
            'trails/0/0/0.pbf',
            'trails/1/0/0.pbf',
            'trails/old/9/9/9.pbf',
        ]);
        jest.mocked(putS3Folder).mockResolvedValue(['trails/0/0/0.pbf', 'trails/1/0/0.pbf']);
        jest.mocked(deleteS3Object).mockResolvedValue(undefined);
        mockGetResults.mockReturnValue({ successes: 1, errors: 0, remaining: 0 });

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        await replaceS3Folder(inFolder, keyPrefix, bucket, contentType);

        expect(deleteS3Object).toHaveBeenCalledTimes(1);
        expect(deleteS3Object).toHaveBeenCalledWith(bucket, 'trails/old/9/9/9.pbf');
        expect(mockLogProgress).toHaveBeenCalledTimes(1);
        expect(mockLogProgress).toHaveBeenCalledWith('trails/old/9/9/9.pbf');
        expect(mockGetResults).toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
            'Deletion complete: 1 success(es), 0 error(s) from s3://my-bucket/trails/'
        );
        consoleSpy.mockRestore();
    });

    it('deletes multiple obsolete keys and logs each', async () => {
        jest.mocked(listS3Folder).mockResolvedValue([
            'trails/0/0/0.pbf',
            'trails/obsolete1.pbf',
            'trails/obsolete2.pbf',
        ]);
        jest.mocked(putS3Folder).mockResolvedValue(['trails/0/0/0.pbf']);
        jest.mocked(deleteS3Object).mockResolvedValue(undefined);
        mockGetResults.mockReturnValue({ successes: 2, errors: 0, remaining: 0 });

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        await replaceS3Folder(inFolder, keyPrefix, bucket, contentType);

        expect(deleteS3Object).toHaveBeenCalledTimes(2);
        expect(deleteS3Object).toHaveBeenCalledWith(bucket, 'trails/obsolete1.pbf');
        expect(deleteS3Object).toHaveBeenCalledWith(bucket, 'trails/obsolete2.pbf');
        expect(mockLogProgress).toHaveBeenCalledTimes(2);
        expect(mockLogProgress).toHaveBeenCalledWith('trails/obsolete1.pbf');
        expect(mockLogProgress).toHaveBeenCalledWith('trails/obsolete2.pbf');
        expect(consoleSpy).toHaveBeenCalledWith(
            'Deletion complete: 2 success(es), 0 error(s) from s3://my-bucket/trails/'
        );
        consoleSpy.mockRestore();
    });

    it('logs errors when delete fails and reports successes/failures at end', async () => {
        jest.mocked(listS3Folder).mockResolvedValue(['trails/old1.pbf', 'trails/old2.pbf']);
        jest.mocked(putS3Folder).mockResolvedValue([]);
        jest.mocked(deleteS3Object)
            .mockRejectedValueOnce(new Error('AccessDenied'))
            .mockResolvedValueOnce(undefined);
        mockGetResults.mockReturnValue({ successes: 1, errors: 1, remaining: 0 });

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await replaceS3Folder(inFolder, keyPrefix, bucket, contentType);

        expect(mockLogError).toHaveBeenCalledTimes(1);
        expect(mockLogError).toHaveBeenCalledWith('trails/old1.pbf: AccessDenied');
        expect(mockLogProgress).toHaveBeenCalledTimes(1);
        expect(mockLogProgress).toHaveBeenCalledWith('trails/old2.pbf');
        expect(mockGetResults).toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
            'Deletion complete: 1 success(es), 1 error(s) from s3://my-bucket/trails/'
        );
        consoleSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    it('does not create logger or log deletion when nothing to delete', async () => {
        jest.mocked(listS3Folder).mockResolvedValue([]);
        jest.mocked(putS3Folder).mockResolvedValue(['trails/new.pbf']);

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        await replaceS3Folder(inFolder, keyPrefix, bucket, contentType);

        expect(deleteS3Object).not.toHaveBeenCalled();
        expect(mockLogProgress).not.toHaveBeenCalled();
        expect(mockGetResults).not.toHaveBeenCalled();
        expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Deletion complete'));
        consoleSpy.mockRestore();
    });
});
