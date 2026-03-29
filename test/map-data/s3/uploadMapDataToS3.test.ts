import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import uploadMapDataToS3 from '../../../src/map-data/s3/uploadMapDataToS3';

const mockReadFile = jest.fn<typeof import('fs/promises').readFile>();
const mockPutS3Object = jest.fn<() => Promise<string>>();

jest.mock('fs/promises', () => ({
    readFile: (...args: unknown[]) => mockReadFile(...args),
}));

jest.mock('ropegeo-common/helpers/s3/putS3Object', () => ({
    __esModule: true,
    default: (...args: unknown[]) => mockPutS3Object(...args),
}));

describe('uploadMapDataToS3', () => {
    const originalEnv = process.env;
    let consoleLogSpy: ReturnType<typeof jest.spyOn>;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        process.env = originalEnv;
        consoleLogSpy.mockRestore();
    });

    it('throws when MAP_DATA_BUCKET_NAME is not set', async () => {
        delete process.env.MAP_DATA_BUCKET_NAME;
        process.env.DEV_ENVIRONMENT = 'prod';

        await expect(
            uploadMapDataToS3('/tmp/file.kml', 'source/1.kml', 'application/vnd.google-earth.kml+xml'),
        ).rejects.toThrow('MAP_DATA_BUCKET_NAME environment variable is not set');

        expect(mockReadFile).not.toHaveBeenCalled();
        expect(mockPutS3Object).not.toHaveBeenCalled();
    });

    it('skips upload and returns URL when DEV_ENVIRONMENT is local', async () => {
        process.env.MAP_DATA_BUCKET_NAME = 'my-map-bucket';
        process.env.DEV_ENVIRONMENT = 'local';

        const url = await uploadMapDataToS3('/tmp/file.kml', 'source/1.kml', 'application/vnd.google-earth.kml+xml');

        expect(url).toBe('https://my-map-bucket.s3.amazonaws.com/source/1.kml');
        expect(mockReadFile).not.toHaveBeenCalled();
        expect(mockPutS3Object).not.toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalledWith(
            'Skipping S3 upload - would upload /tmp/file.kml to s3://my-map-bucket/source/1.kml (no bucket configured locally)',
        );
    });

    it('reads file and calls putS3Object when not local and returns URL', async () => {
        process.env.MAP_DATA_BUCKET_NAME = 'my-map-bucket';
        process.env.DEV_ENVIRONMENT = 'prod';

        const fileBody = Buffer.from('<kml/>');
        mockReadFile.mockResolvedValue(fileBody);
        mockPutS3Object.mockResolvedValue('https://my-map-bucket.s3.amazonaws.com/source/1.kml');

        const url = await uploadMapDataToS3('/path/to/file.kml', 'source/1.kml', 'application/vnd.google-earth.kml+xml');

        expect(url).toBe('https://my-map-bucket.s3.amazonaws.com/source/1.kml');
        expect(mockReadFile).toHaveBeenCalledWith('/path/to/file.kml');
        expect(mockPutS3Object).toHaveBeenCalledWith('my-map-bucket', 'source/1.kml', fileBody, 'application/vnd.google-earth.kml+xml');
    });

    it('propagates readFile errors', async () => {
        process.env.MAP_DATA_BUCKET_NAME = 'my-map-bucket';
        process.env.DEV_ENVIRONMENT = 'prod';
        mockReadFile.mockRejectedValue(new Error('ENOENT: no such file'));

        await expect(
            uploadMapDataToS3('/missing.kml', 'source/1.kml', 'application/vnd.google-earth.kml+xml'),
        ).rejects.toThrow('ENOENT: no such file');

        expect(mockPutS3Object).not.toHaveBeenCalled();
    });

    it('propagates putS3Object errors', async () => {
        process.env.MAP_DATA_BUCKET_NAME = 'my-map-bucket';
        process.env.DEV_ENVIRONMENT = 'prod';
        mockReadFile.mockResolvedValue(Buffer.from('data'));
        mockPutS3Object.mockRejectedValue(new Error('S3 upload failed'));

        await expect(
            uploadMapDataToS3('/file.kml', 'source/1.kml', 'application/vnd.google-earth.kml+xml'),
        ).rejects.toThrow('S3 upload failed');
    });
});
