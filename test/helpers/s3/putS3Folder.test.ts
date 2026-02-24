import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { putS3Folder } from '../../../src/helpers/s3/putS3Folder';
import putS3Object from '../../../src/helpers/s3/putS3Object';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

jest.mock('../../../src/helpers/s3/putS3Object', () => ({ __esModule: true, default: jest.fn() }));
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

        await putS3Folder(inFolder, keyPrefix, bucket, contentType);

        expect(putS3Object).toHaveBeenCalledTimes(2);
        expect(putS3Object).toHaveBeenCalledWith(bucket, 'trails/0/0/0.pbf', Buffer.from('pbf-content'), contentType);
        expect(putS3Object).toHaveBeenCalledWith(bucket, 'trails/1/0/0.pbf', Buffer.from('pbf-content'), contentType);
    });

    it('strips trailing slash from keyPrefix', async () => {
        jest.mocked(readdirSync).mockReturnValueOnce([{ name: 'file.pbf', isDirectory: () => false }] as unknown as ReturnType<typeof readdirSync>);
        jest.mocked(readFileSync).mockReturnValue(Buffer.from('x'));

        await putS3Folder(inFolder, 'trails/', bucket, contentType);

        expect(putS3Object).toHaveBeenCalledWith(bucket, 'trails/file.pbf', expect.any(Buffer), contentType);
    });

    it('uploads single file with correct key', async () => {
        jest.mocked(readdirSync).mockReturnValueOnce([{ name: 'root.txt', isDirectory: () => false }] as unknown as ReturnType<typeof readdirSync>);
        jest.mocked(readFileSync).mockReturnValue(Buffer.from('content'));

        await putS3Folder(inFolder, 'myPrefix', bucket, 'text/plain');

        expect(readFileSync).toHaveBeenCalledWith(join(inFolder, 'root.txt'));
        expect(putS3Object).toHaveBeenCalledWith(bucket, 'myPrefix/root.txt', Buffer.from('content'), 'text/plain');
    });
});
