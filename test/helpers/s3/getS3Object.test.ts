import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import getS3Object from '../../../src/helpers/s3/getS3Object';
import { resetS3ClientForTests } from '../../../src/helpers/s3/getS3Client';

const mockSend = jest.fn<() => Promise<unknown>>();
const mockS3Client = {
    send: mockSend,
};

jest.mock('@aws-sdk/client-s3', () => {
    const MockS3Client = jest.fn(() => mockS3Client);
    const MockGetObjectCommand = jest.fn();
    return {
        S3Client: MockS3Client,
        GetObjectCommand: MockGetObjectCommand,
    };
});

const { GetObjectCommand: MockGetObjectCommandConstructor } = require('@aws-sdk/client-s3') as {
    GetObjectCommand: jest.Mock;
};

describe('getS3Object', () => {
    beforeEach(() => {
        resetS3ClientForTests();
        jest.clearAllMocks();
    });

    it('returns body and contentType when object exists', async () => {
        const bodyContent = '<html><body>Docs</body></html>';
        mockSend.mockResolvedValue({
            Body: { transformToString: () => Promise.resolve(bodyContent) },
            ContentType: 'text/html',
        });

        const result = await getS3Object('my-bucket', 'index.html');

        expect(MockGetObjectCommandConstructor).toHaveBeenCalledWith({
            Bucket: 'my-bucket',
            Key: 'index.html',
        });
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            body: bodyContent,
            contentType: 'text/html',
        });
    });

    it('returns body when ContentType is not set', async () => {
        mockSend.mockResolvedValue({
            Body: { transformToString: () => Promise.resolve('raw content') },
        });

        const result = await getS3Object('bucket', 'some-key');

        expect(result).toEqual({
            body: 'raw content',
            contentType: undefined,
        });
    });

    it('throws when key does not exist (NoSuchKey)', async () => {
        const noSuchKey = new Error('The specified key does not exist.');
        (noSuchKey as Error & { name: string }).name = 'NoSuchKey';
        mockSend.mockRejectedValue(noSuchKey);

        await expect(getS3Object('bucket', 'missing.yaml')).rejects.toMatchObject({
            name: 'NoSuchKey',
            message: 'The specified key does not exist.',
        });

        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('propagates other S3 errors', async () => {
        mockSend.mockRejectedValue(new Error('AccessDenied'));

        await expect(getS3Object('bucket', 'key')).rejects.toThrow('AccessDenied');
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('throws when response Body is null', async () => {
        mockSend.mockResolvedValue({ Body: null, ContentType: 'text/plain' });

        await expect(getS3Object('bucket', 'key')).rejects.toMatchObject({
            name: 'NoSuchKey',
            message: 'S3 GetObject returned no body',
        });
    });
});
