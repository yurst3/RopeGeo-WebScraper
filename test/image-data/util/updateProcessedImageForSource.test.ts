import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PageDataSource } from 'ropegeo-common/classes';
import updateProcessedImageForSource from '../../../src/image-data/util/updateProcessedImageForSource';

const mockUpdateProcessedImage = jest.fn<() => Promise<void>>();

jest.mock('../../../src/ropewiki/database/updateProcessedImage', () => ({
    __esModule: true,
    default: (...args: unknown[]) => mockUpdateProcessedImage(...args),
}));

const mockConn = {} as unknown as import('zapatos/db').Queryable;

describe('updateProcessedImageForSource', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('calls updateProcessedImage (Ropewiki) with conn, rowId, and imageDataId when pageDataSource is Ropewiki', async () => {
        mockUpdateProcessedImage.mockResolvedValue(undefined);

        const rowId = 'c1000001-0001-4000-8000-000000000001';
        const imageDataId = 'd1000001-0001-4000-8000-000000000001';

        await updateProcessedImageForSource(
            mockConn,
            PageDataSource.Ropewiki,
            rowId,
            imageDataId,
        );

        expect(mockUpdateProcessedImage).toHaveBeenCalledTimes(1);
        expect(mockUpdateProcessedImage).toHaveBeenCalledWith(mockConn, rowId, imageDataId);
    });

    it('throws for unsupported pageDataSource', async () => {
        const unsupportedSource = 'Other' as PageDataSource;
        const rowId = 'c1000001-0001-4000-8000-000000000001';
        const imageDataId = 'd1000001-0001-4000-8000-000000000001';

        await expect(
            updateProcessedImageForSource(mockConn, unsupportedSource, rowId, imageDataId),
        ).rejects.toThrow(/updateProcessedImageForSource: unsupported pageDataSource/);

        expect(mockUpdateProcessedImage).not.toHaveBeenCalled();
    });
});
