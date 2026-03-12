import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { runAvifPipeline } from '../../../src/image-data/util/runAvifPipeline';
import { Metadata, Orientation } from '../../../src/image-data/types/metadata';

const createChain = (data: Buffer, width: number, height: number) => ({
    resize: jest.fn().mockReturnThis(),
    avif: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue({ data, info: { width, height } }),
});

jest.mock('sharp', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('fs/promises', () => ({ stat: jest.fn().mockResolvedValue({ size: 10240 }) }));

const sharpMock = require('sharp').default as jest.MockedFunction<typeof import('sharp')>;
const statMock = require('fs/promises').stat as jest.MockedFunction<typeof import('fs/promises').stat>;

describe('runAvifPipeline', () => {
    const previewBuffer = Buffer.alloc(1536);
    const bannerBuffer = Buffer.alloc(5120);
    const fullBuffer = Buffer.alloc(10240);
    const losslessBuffer = Buffer.alloc(20480);

    beforeEach(async () => {
        jest.clearAllMocks();
        statMock.mockResolvedValue({ size: 10240 });

        const sourcePipelineMock = {
            metadata: jest.fn().mockResolvedValue({ width: 800, height: 600, orientation: 6 }),
        };

        const pipelineMock = {
            clone: jest.fn(),
        };
        pipelineMock.clone
            .mockReturnValueOnce(createChain(previewBuffer, 256, 192))
            .mockReturnValueOnce(createChain(bannerBuffer, 512, 384))
            .mockReturnValueOnce(createChain(fullBuffer, 800, 600))
            .mockReturnValueOnce(createChain(losslessBuffer, 800, 600));

        sharpMock
            .mockReturnValueOnce(sourcePipelineMock)
            .mockReturnValueOnce({ rotate: jest.fn().mockReturnValue(pipelineMock) });
    });

    it('reads source metadata then runs pipeline and returns four buffers and metadata', async () => {
        const source = Buffer.alloc(2048);

        const result = await runAvifPipeline(source);

        expect(sharpMock).toHaveBeenCalledWith(source);
        expect(result.preview).toEqual(previewBuffer);
        expect(result.banner).toEqual(bannerBuffer);
        expect(result.full).toEqual(fullBuffer);
        expect(result.lossless).toEqual(losslessBuffer);
        expect(result.metadata).toBeInstanceOf(Metadata);
        expect(result.metadata.preview!.sizeKB).toBe(1.5);
        expect(result.metadata.preview!.quality).toBe(50);
        expect(result.metadata.banner!.sizeKB).toBe(5);
        expect(result.metadata.banner!.quality).toBe(75);
        expect(result.metadata.full!.sizeKB).toBe(10);
        expect(result.metadata.full!.quality).toBe(75);
        expect(result.metadata.lossless!.sizeKB).toBe(20);
        expect(result.metadata.lossless!.quality).toBeUndefined();
        expect(result.metadata.source!.orientation).toBe(Orientation.Rotated90CW);
        expect(result.metadata.source!.sizeKB).toBe(2);
    });

    it('uses stat for file path source to get source size', async () => {
        statMock.mockResolvedValueOnce({ size: 51200 });

        const sourcePipelineMock = {
            metadata: jest.fn().mockResolvedValue({ width: 100, height: 100, orientation: 1 }),
        };
        const pipelineMock = {
            clone: jest.fn(),
        };
        const buf = Buffer.alloc(1);
        pipelineMock.clone
            .mockReturnValueOnce(createChain(buf, 100, 100))
            .mockReturnValueOnce(createChain(buf, 100, 100))
            .mockReturnValueOnce(createChain(buf, 100, 100))
            .mockReturnValueOnce(createChain(buf, 100, 100));
        sharpMock
            .mockReturnValueOnce(sourcePipelineMock)
            .mockReturnValueOnce({ rotate: jest.fn().mockReturnValue(pipelineMock) });

        const result = await runAvifPipeline('/tmp/image.jpg');

        expect(statMock).toHaveBeenCalledWith('/tmp/image.jpg');
        expect(result.metadata.source!.sizeKB).toBe(50);
    });
});
