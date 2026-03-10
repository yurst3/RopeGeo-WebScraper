import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RopewikiImage } from '../../../src/ropewiki/types/image';
import filterImagesToProcess from '../../../src/ropewiki/database/filterImagesToProcess';

declare global {
    var __filterImagesToProcessMocks: {
        run: ReturnType<typeof jest.fn>;
        select: ReturnType<typeof jest.fn>;
        sql: ReturnType<typeof jest.fn>;
    };
}

jest.mock('zapatos/db', () => {
    const actual = jest.requireActual<typeof import('zapatos/db')>('zapatos/db');
    const runFn = jest.fn();
    const selectFn = jest.fn(() => ({ run: runFn }));
    const sqlFn = jest.fn(() => ({ run: runFn }));
    globalThis.__filterImagesToProcessMocks = { run: runFn, select: selectFn, sql: sqlFn };
    return {
        ...actual,
        select: selectFn,
        sql: sqlFn,
        is: (_col: string, _ids: string[]) => ({ col: _col, ids: _ids }),
    };
});

const mockConn = {} as unknown as import('zapatos/db').Queryable;

describe('filterImagesToProcess', () => {
    let mocks: typeof globalThis.__filterImagesToProcessMocks;

    beforeEach(() => {
        mocks = globalThis.__filterImagesToProcessMocks;
        jest.clearAllMocks();
    });

    it('returns empty array when images is empty', async () => {
        const result = await filterImagesToProcess(mockConn, []);
        expect(result).toEqual([]);
        expect(mocks.sql).not.toHaveBeenCalled();
    });

    it('returns all images when none have processedImage set', async () => {
        const img1 = new RopewikiImage(undefined, 'https://a.com/l1', 'https://a.com/f1.jpg', undefined, 1);
        img1.id = 'id-1';
        const img2 = new RopewikiImage(undefined, 'https://a.com/l2', 'https://a.com/f2.jpg', undefined, 2);
        img2.id = 'id-2';

        const result = await filterImagesToProcess(mockConn, [img1, img2]);

        expect(result).toHaveLength(2);
        expect(result).toContain(img1);
        expect(result).toContain(img2);
        expect(mocks.sql).not.toHaveBeenCalled();
    });

    it('returns only images where processedImage is null or source differs from fileUrl', async () => {
        const imageDataId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
        const imgNoProcessed = new RopewikiImage(undefined, 'https://a.com/l1', 'https://a.com/f1.jpg', undefined, 1);
        imgNoProcessed.id = 'id-1';
        imgNoProcessed.processedImage = null;

        const imgSourceMatches = new RopewikiImage(undefined, 'https://a.com/l2', 'https://a.com/f2.jpg', undefined, 2);
        imgSourceMatches.id = 'id-2';
        imgSourceMatches.processedImage = imageDataId;

        const imgSourceDiffers = new RopewikiImage(undefined, 'https://a.com/l3', 'https://a.com/f3-new.jpg', undefined, 3);
        imgSourceDiffers.id = 'id-3';
        imgSourceDiffers.processedImage = imageDataId;

        mocks.run.mockResolvedValue([
            { id: imageDataId, sourceUrl: 'https://a.com/f2.jpg' },
        ]);

        const result = await filterImagesToProcess(mockConn, [imgNoProcessed, imgSourceMatches, imgSourceDiffers]);

        expect(result).toHaveLength(2);
        expect(result).toContain(imgNoProcessed);
        expect(result).toContain(imgSourceDiffers);
        expect(result).not.toContain(imgSourceMatches);
        expect(mocks.sql).toHaveBeenCalled();
    });

    it('includes image when processedImage points to ImageData with different source', async () => {
        const imageDataId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
        const img = new RopewikiImage(undefined, 'https://a.com/l', 'https://a.com/current.jpg', undefined, 1);
        img.id = 'id-1';
        img.processedImage = imageDataId;

        mocks.run.mockResolvedValue([
            { id: imageDataId, sourceUrl: 'https://a.com/old.jpg' },
        ]);

        const result = await filterImagesToProcess(mockConn, [img]);

        expect(result).toHaveLength(1);
        expect(result[0]).toBe(img);
    });

    it('includes image when processedImage id not found in ImageData (missing row)', async () => {
        const imageDataId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
        const img = new RopewikiImage(undefined, 'https://a.com/l', 'https://a.com/f.jpg', undefined, 1);
        img.id = 'id-1';
        img.processedImage = imageDataId;

        mocks.run.mockResolvedValue([]);

        const result = await filterImagesToProcess(mockConn, [img]);

        expect(result).toHaveLength(1);
        expect(result[0]).toBe(img);
    });
});
