import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import putS3Object from '../../../src/helpers/s3/putS3Object';
import { resetS3ClientForTests } from '../../../src/helpers/s3/getS3Client';

const mockSend = jest.fn<() => Promise<unknown>>();
const mockS3Client = {
    send: mockSend,
};

jest.mock('@aws-sdk/client-s3', () => {
    const MockS3Client = jest.fn(() => mockS3Client);
    const MockPutObjectCommand = jest.fn();
    return {
        S3Client: MockS3Client,
        PutObjectCommand: MockPutObjectCommand,
    };
});

const { S3Client: MockS3ClientConstructor, PutObjectCommand: MockPutObjectCommandConstructor } =
    require('@aws-sdk/client-s3') as {
        S3Client: jest.Mock;
        PutObjectCommand: jest.Mock;
    };

describe('putS3Object', () => {
    const originalEnv = process.env;
    let consoleLogSpy: ReturnType<typeof jest.spyOn>;

    beforeEach(() => {
        resetS3ClientForTests();
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        mockSend.mockResolvedValue({});
    });

    afterEach(() => {
        process.env = originalEnv;
        consoleLogSpy.mockRestore();
    });

    it('skips upload and returns URL when DEV_ENVIRONMENT is local', async () => {
        process.env.DEV_ENVIRONMENT = 'local';
        const bucket = 'my-bucket';
        const key = 'path/to/file.json';
        const body = '{"foo":"bar"}';
        const contentType = 'application/json';

        const url = await putS3Object(bucket, key, body, contentType);

        expect(consoleLogSpy).toHaveBeenCalledWith(
            'Skipping S3 put - would upload to s3://my-bucket/path/to/file.json (no bucket configured locally)',
        );
        expect(MockS3ClientConstructor).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
        expect(url).toBe('https://my-bucket.s3.amazonaws.com/path/to/file.json');
    });

    it('uploads and returns URL when not local', async () => {
        delete process.env.DEV_ENVIRONMENT;
        const bucket = 'test-bucket';
        const key = 'geojson/abc123.geojson';
        const body = '{"type":"FeatureCollection","features":[]}';
        const contentType = 'application/geo+json';

        const url = await putS3Object(bucket, key, body, contentType);

        expect(MockS3ClientConstructor).toHaveBeenCalledWith({});
        expect(MockPutObjectCommandConstructor).toHaveBeenCalledWith({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
        });
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(consoleLogSpy).not.toHaveBeenCalled();
        expect(url).toBe('https://test-bucket.s3.amazonaws.com/geojson/abc123.geojson');
    });

    it('accepts Buffer as body', async () => {
        delete process.env.DEV_ENVIRONMENT;
        const bucket = 'bucket';
        const key = 'key';
        const body = Buffer.from('binary data');
        const contentType = 'application/octet-stream';

        const url = await putS3Object(bucket, key, body, contentType);

        expect(MockPutObjectCommandConstructor).toHaveBeenCalledWith({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
        });
        expect(url).toBe('https://bucket.s3.amazonaws.com/key');
    });

    it('accepts Uint8Array as body', async () => {
        delete process.env.DEV_ENVIRONMENT;
        const bucket = 'bucket';
        const key = 'key';
        const body = new Uint8Array([1, 2, 3]);
        const contentType = 'application/octet-stream';

        const url = await putS3Object(bucket, key, body, contentType);

        expect(MockPutObjectCommandConstructor).toHaveBeenCalledWith({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
        });
        expect(url).toBe('https://bucket.s3.amazonaws.com/key');
    });

    it('propagates errors from S3 send', async () => {
        delete process.env.DEV_ENVIRONMENT;
        mockSend.mockRejectedValue(new Error('S3 upload failed'));

        await expect(
            putS3Object('bucket', 'key', 'body', 'text/plain'),
        ).rejects.toThrow('S3 upload failed');

        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('does not skip when DEV_ENVIRONMENT is not local', async () => {
        process.env.DEV_ENVIRONMENT = 'dev';
        const url = await putS3Object('bucket', 'key', 'data', 'text/plain');

        expect(consoleLogSpy).not.toHaveBeenCalled();
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(url).toBe('https://bucket.s3.amazonaws.com/key');
    });
});
