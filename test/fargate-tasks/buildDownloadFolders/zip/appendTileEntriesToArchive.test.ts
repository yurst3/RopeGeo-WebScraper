import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { gzipSync } from 'zlib';

jest.mock('../../../../src/api/getMapdataTiles/s3/listAllPbfKeysAndTotalBytes', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../../src/fargate-tasks/buildDownloadFolders/s3/fetchS3ObjectBytes', () => ({
    fetchS3ObjectBytes: jest.fn(),
}));

import listAllPbfKeysAndTotalBytes from '../../../../src/api/getMapdataTiles/s3/listAllPbfKeysAndTotalBytes';
import { fetchS3ObjectBytes } from '../../../../src/fargate-tasks/buildDownloadFolders/s3/fetchS3ObjectBytes';
import { appendTileEntriesToArchive } from '../../../../src/fargate-tasks/buildDownloadFolders/zip/appendTileEntriesToArchive';

describe('appendTileEntriesToArchive', () => {
    const mapDataId = 'cccccccc-dddd-4eee-ffff-000000000001';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('appends gunzipped tile entries when S3 objects are gzip-compressed', async () => {
        const tileBody = Buffer.from('tile-bytes');
        jest.mocked(listAllPbfKeysAndTotalBytes).mockResolvedValue({
            keys: [`tiles/${mapDataId}/0/0/0.pbf`, 'invalid/key'],
            totalBytes: 100,
        });
        jest.mocked(fetchS3ObjectBytes).mockResolvedValue(gzipSync(tileBody));
        const archive = { append: jest.fn() };

        await appendTileEntriesToArchive(archive as never, 'map-data-bucket', mapDataId);

        expect(fetchS3ObjectBytes).toHaveBeenCalledWith(
            'map-data-bucket',
            `tiles/${mapDataId}/0/0/0.pbf`,
        );
        expect(archive.append).toHaveBeenCalledTimes(1);
        expect(archive.append).toHaveBeenCalledWith(
            tileBody,
            expect.objectContaining({
                name: expect.stringContaining(mapDataId),
                store: true,
            }),
        );
    });

    it('appends raw tile bytes when S3 objects are not gzip-compressed', async () => {
        const tileBody = Buffer.from('raw-mvt-bytes');
        jest.mocked(listAllPbfKeysAndTotalBytes).mockResolvedValue({
            keys: [`tiles/${mapDataId}/0/0/0.pbf`],
            totalBytes: tileBody.length,
        });
        jest.mocked(fetchS3ObjectBytes).mockResolvedValue(tileBody);
        const archive = { append: jest.fn() };

        await appendTileEntriesToArchive(archive as never, 'map-data-bucket', mapDataId);

        expect(archive.append).toHaveBeenCalledWith(
            tileBody,
            expect.objectContaining({
                name: expect.stringContaining(mapDataId),
                store: true,
            }),
        );
    });

    it('skips keys that do not match the tile prefix pattern', async () => {
        jest.mocked(listAllPbfKeysAndTotalBytes).mockResolvedValue({
            keys: ['tiles/other-id/0/0/0.pbf'],
            totalBytes: 100,
        });
        const archive = { append: jest.fn() };

        await appendTileEntriesToArchive(archive as never, 'map-data-bucket', mapDataId);

        expect(fetchS3ObjectBytes).not.toHaveBeenCalled();
        expect(archive.append).not.toHaveBeenCalled();
    });
});
