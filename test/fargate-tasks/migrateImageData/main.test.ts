import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { main } from '../../../src/fargate-tasks/migrateImageData/main';
import getDatabaseConnection from '../../../src/helpers/getDatabaseConnection';
import { getImageDataToMigrate } from '../../../src/fargate-tasks/migrateImageData/database/getImageDataToMigrate';
import { getS3ObjectToFile } from '../../../src/fargate-tasks/migrateImageData/util/getS3ObjectToFile';
import { headSourceSizeKb } from '../../../src/fargate-tasks/migrateImageData/util/headSourceSizeKb';
import { runAvifPipeline } from '../../../src/image-data/util/runAvifPipeline';
import uploadImageDataToS3 from '../../../src/image-data/s3/uploadImageDataToS3';
import upsertImageData from '../../../src/image-data/database/upsertImageData';
import { Metadata } from '../../../src/image-data/types/metadata';

jest.mock('../../../src/helpers/getDatabaseConnection', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../src/fargate-tasks/migrateImageData/database/getImageDataToMigrate', () => ({
    getImageDataToMigrate: jest.fn(),
}));
jest.mock('../../../src/fargate-tasks/migrateImageData/util/getS3ObjectToFile', () => ({
    getS3ObjectToFile: jest.fn(),
}));
jest.mock('../../../src/fargate-tasks/migrateImageData/util/headSourceSizeKb', () => ({
    headSourceSizeKb: jest.fn(),
}));
jest.mock('../../../src/image-data/util/runAvifPipeline', () => ({
    runAvifPipeline: jest.fn(),
}));
jest.mock('../../../src/image-data/s3/uploadImageDataToS3', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../src/image-data/database/upsertImageData', () => ({ __esModule: true, default: jest.fn() }));

describe('main (migrateImageData)', () => {
    const rowId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const mockRows = [
        {
            id: rowId,
            previewUrl: null,
            bannerUrl: null,
            sourceUrl: 'https://example.com/source.jpg',
            losslessUrl: 'https://api.example/images/aa/full.avif',
        },
    ];
    const mockMetadata = new Metadata();
    let originalEnv: NodeJS.ProcessEnv;
    let mockRelease: ReturnType<typeof jest.fn>;
    let mockPoolEnd: ReturnType<typeof jest.fn>;

    beforeEach(() => {
        mockMetadata.source = { sizeKB: 0, dimensions: { width: 100, height: 100 }, orientation: 1 };
        jest.clearAllMocks();
        originalEnv = process.env;
        process.env = {
            ...originalEnv,
            IMAGE_BUCKET_NAME: 'test-image-bucket',
            IMAGE_PUBLIC_BASE_URL: 'https://api.example',
        };
        mockRelease = jest.fn();
        mockPoolEnd = jest.fn();
        const mockPool = {
            connect: jest.fn(),
            end: mockPoolEnd,
        };
        (mockPool.connect as ReturnType<typeof jest.fn>).mockResolvedValue({ release: mockRelease });
        jest.mocked(getDatabaseConnection).mockResolvedValue(mockPool as unknown as Awaited<ReturnType<typeof getDatabaseConnection>>);
        jest.mocked(getImageDataToMigrate).mockResolvedValue(mockRows);
        jest.mocked(getS3ObjectToFile).mockResolvedValue(undefined);
        jest.mocked(headSourceSizeKb).mockResolvedValue({ sizeKB: 2.5 });
        jest.mocked(runAvifPipeline).mockResolvedValue({
            preview: Buffer.from('preview'),
            banner: Buffer.from('banner'),
            full: Buffer.from('full'),
            lossless: Buffer.from('lossless'),
            metadata: mockMetadata,
        });
        jest.mocked(uploadImageDataToS3).mockResolvedValue('https://api.example/images/aa/preview.avif');
        jest.mocked(upsertImageData).mockResolvedValue({} as never);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('throws when IMAGE_BUCKET_NAME is not set', async () => {
        delete process.env.IMAGE_BUCKET_NAME;

        await expect(main()).rejects.toThrow('IMAGE_BUCKET_NAME');

        expect(getDatabaseConnection).not.toHaveBeenCalled();
    });

    it('throws when IMAGE_PUBLIC_BASE_URL is not set', async () => {
        delete process.env.IMAGE_PUBLIC_BASE_URL;

        await expect(main()).rejects.toThrow('IMAGE_PUBLIC_BASE_URL');
    });

    it('fetches rows, runs pipeline, uploads and upserts for each row', async () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        await main();

        expect(getDatabaseConnection).toHaveBeenCalledTimes(1);
        expect(getImageDataToMigrate).toHaveBeenCalledWith(expect.anything());
        expect(getS3ObjectToFile).toHaveBeenCalledWith('test-image-bucket', `${rowId}/full.avif`, expect.stringContaining('migrate-'));
        expect(headSourceSizeKb).toHaveBeenCalledWith('https://example.com/source.jpg');
        expect(runAvifPipeline).toHaveBeenCalledWith(expect.stringContaining('migrate-'));
        expect(uploadImageDataToS3).toHaveBeenCalledTimes(4);
        expect(upsertImageData).toHaveBeenCalledTimes(1);
        expect(mockRelease).toHaveBeenCalledTimes(1);
        expect(mockPoolEnd).toHaveBeenCalledTimes(1);
        expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/Migration complete: 1 success/));
        logSpy.mockRestore();
    });

    it('sets metadata.source to null when headSourceSizeKb returns null', async () => {
        jest.mocked(headSourceSizeKb).mockResolvedValue(null);
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        await main();

        expect(upsertImageData).toHaveBeenCalledTimes(1);
        const imageDataArg = jest.mocked(upsertImageData).mock.calls[0]?.[1];
        expect(imageDataArg?.metadata?.source).toBeNull();
        logSpy.mockRestore();
    });

    it('logs and continues to next row when getS3ObjectToFile throws', async () => {
        jest.mocked(getS3ObjectToFile).mockRejectedValueOnce(new Error('NoSuchKey'));
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        await main();

        expect(upsertImageData).not.toHaveBeenCalled();
        expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/Migration complete: 0 success.*1 error/));
        errorSpy.mockRestore();
        logSpy.mockRestore();
    });

    it('logs "No ImageData rows to migrate" when getImageDataToMigrate returns empty', async () => {
        jest.mocked(getImageDataToMigrate).mockResolvedValue([]);
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        await main();

        expect(logSpy).toHaveBeenCalledWith('No ImageData rows to migrate.');
        expect(getS3ObjectToFile).not.toHaveBeenCalled();
        expect(runAvifPipeline).not.toHaveBeenCalled();
        logSpy.mockRestore();
    });

    it('releases client and ends pool when getImageDataToMigrate throws', async () => {
        jest.mocked(getImageDataToMigrate).mockRejectedValue(new Error('DB error'));

        await expect(main()).rejects.toThrow('DB error');

        expect(mockRelease).toHaveBeenCalledTimes(1);
        expect(mockPoolEnd).toHaveBeenCalledTimes(1);
    });
});
