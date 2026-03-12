import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Readable } from 'stream';
import { writeFileSync, unlinkSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getS3ObjectToFile } from '../../../../src/fargate-tasks/migrateImageData/util/getS3ObjectToFile';
import { getS3Client } from '../../../../src/helpers/s3/getS3Client';

jest.mock('../../../../src/helpers/s3/getS3Client', () => ({ getS3Client: jest.fn() }));

describe('getS3ObjectToFile', () => {
    const bucket = 'test-bucket';
    const key = 'abc/full.avif';
    let destPath: string;
    let mockSend: ReturnType<typeof jest.fn>;

    beforeEach(() => {
        destPath = join(tmpdir(), `getS3ObjectToFile-test-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`);
        mockSend = jest.fn();
        jest.mocked(getS3Client).mockReturnValue({ send: mockSend } as unknown as ReturnType<typeof getS3Client>);
    });

    afterEach(() => {
        if (destPath && existsSync(destPath)) {
            try {
                unlinkSync(destPath);
            } catch {
                // ignore
            }
        }
    });

    it('streams S3 body to the destination file', async () => {
        const bodyContent = Buffer.from('avif-binary-content');
        mockSend.mockResolvedValueOnce({
            Body: Readable.from(bodyContent),
        });

        await getS3ObjectToFile(bucket, key, destPath);

        expect(mockSend).toHaveBeenCalledTimes(1);
        const sendArg = mockSend.mock.calls[0]?.[0];
        expect(sendArg?.input).toEqual({ Bucket: bucket, Key: key });
        expect(existsSync(destPath)).toBe(true);
        expect(readFileSync(destPath)).toEqual(bodyContent);
    });

    it('throws when S3 returns no body', async () => {
        mockSend.mockResolvedValueOnce({ Body: null });

        await expect(getS3ObjectToFile(bucket, key, destPath)).rejects.toMatchObject({
            message: 'S3 GetObject returned no body',
            name: 'NoSuchKey',
        });

        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('throws when S3 send rejects', async () => {
        mockSend.mockRejectedValueOnce(new Error('NoSuchKey'));

        await expect(getS3ObjectToFile(bucket, key, destPath)).rejects.toThrow('NoSuchKey');
    });
});
