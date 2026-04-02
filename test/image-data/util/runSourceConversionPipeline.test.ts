import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ImageVersion } from 'ropegeo-common/classes';
import { runSourceConversionPipeline } from '../../../src/image-data/util/runSourceConversionPipeline';
import { Metadata, Orientation } from '../../../src/image-data/types/metadata';
import { ALL_IMAGE_VERSIONS } from '../../../src/image-data/util/imageVersionFile';

const createChain = (data: Buffer, width: number, height: number) => ({
    resize: jest.fn().mockReturnThis(),
    avif: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue({ data, info: { width, height } }),
});

jest.mock('sharp', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('fs/promises', () => ({ stat: jest.fn().mockResolvedValue({ size: 10240 }) }));

const sharpMock = require('sharp').default as jest.MockedFunction<typeof import('sharp')>;
const statMock = require('fs/promises').stat as jest.MockedFunction<typeof import('fs/promises').stat>;

describe('runSourceConversionPipeline', () => {
    const previewBuffer = Buffer.alloc(1536);
    const linkPreviewBuffer = Buffer.alloc(900);
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
            .mockReturnValueOnce(createChain(linkPreviewBuffer, 256, 192))
            .mockReturnValueOnce(createChain(bannerBuffer, 512, 384))
            .mockReturnValueOnce(createChain(fullBuffer, 800, 600))
            .mockReturnValueOnce(createChain(losslessBuffer, 800, 600));

        sharpMock
            .mockReturnValueOnce(sourcePipelineMock)
            .mockReturnValueOnce({ rotate: jest.fn().mockReturnValue(pipelineMock) });
    });

    it('returns buffers and metadata for all versions', async () => {
        const source = Buffer.alloc(2048);

        const result = await runSourceConversionPipeline(source, ALL_IMAGE_VERSIONS);

        expect(sharpMock).toHaveBeenCalledWith(source);
        expect(result.buffers[ImageVersion.preview]).toEqual(previewBuffer);
        expect(result.buffers[ImageVersion.linkPreview]).toEqual(linkPreviewBuffer);
        expect(result.buffers[ImageVersion.banner]).toEqual(bannerBuffer);
        expect(result.buffers[ImageVersion.full]).toEqual(fullBuffer);
        expect(result.buffers[ImageVersion.lossless]).toEqual(losslessBuffer);
        expect(result.metadata).toBeInstanceOf(Metadata);
        expect(result.metadata[ImageVersion.preview]!.sizeKB).toBe(1.5);
        expect(result.metadata[ImageVersion.preview]!.mimeType).toBe('image/avif');
        expect(result.metadata[ImageVersion.linkPreview]!.mimeType).toBe('image/jpeg');
        expect(result.metadata[ImageVersion.banner]!.quality).toBe(75);
        expect(result.metadata[ImageVersion.lossless]!.quality).toBeUndefined();
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
            .mockReturnValueOnce(createChain(buf, 100, 100))
            .mockReturnValueOnce(createChain(buf, 100, 100));
        sharpMock
            .mockReturnValueOnce(sourcePipelineMock)
            .mockReturnValueOnce({ rotate: jest.fn().mockReturnValue(pipelineMock) });

        const result = await runSourceConversionPipeline('/tmp/image.jpg', ALL_IMAGE_VERSIONS);

        expect(statMock).toHaveBeenCalledWith('/tmp/image.jpg');
        expect(result.metadata.source!.sizeKB).toBe(50);
    });

    it('encodes only requested versions', async () => {
        sharpMock.mockReset();
        const sourcePipelineMock = {
            metadata: jest.fn().mockResolvedValue({ width: 100, height: 100, orientation: 1 }),
        };
        const pipelineMock = { clone: jest.fn() };
        const lp = Buffer.alloc(2);
        pipelineMock.clone.mockReturnValueOnce(createChain(lp, 50, 50));
        sharpMock
            .mockReturnValueOnce(sourcePipelineMock)
            .mockReturnValueOnce({ rotate: jest.fn().mockReturnValue(pipelineMock) });

        const result = await runSourceConversionPipeline(Buffer.alloc(8), [ImageVersion.linkPreview]);

        expect(pipelineMock.clone).toHaveBeenCalledTimes(1);
        expect(result.buffers[ImageVersion.linkPreview]).toEqual(lp);
        expect(result.buffers[ImageVersion.preview]).toBeUndefined();
    });

    it('extends existingMetadata with encoded versions and refreshed source', async () => {
        sharpMock.mockReset();
        const sourcePipelineMock = {
            metadata: jest.fn().mockResolvedValue({ width: 100, height: 100, orientation: 1 }),
        };
        const pipelineMock = { clone: jest.fn() };
        const lp = Buffer.alloc(2);
        pipelineMock.clone.mockReturnValueOnce(createChain(lp, 50, 50));
        sharpMock
            .mockReturnValueOnce(sourcePipelineMock)
            .mockReturnValueOnce({ rotate: jest.fn().mockReturnValue(pipelineMock) });

        const existing = Metadata.fromJSON({
            preview: {
                sizeKB: 9,
                dimensions: { width: 100, height: 100 },
                orientation: 1,
                mimeType: 'image/avif',
            },
            linkPreview: null,
            banner: null,
            full: null,
            lossless: null,
            source: { sizeKB: 99, dimensions: { width: 1, height: 1 }, orientation: 1 },
        });

        const result = await runSourceConversionPipeline(
            Buffer.alloc(8),
            [ImageVersion.linkPreview],
            existing,
        );

        expect(result.metadata[ImageVersion.preview]!.sizeKB).toBe(9);
        expect(result.metadata[ImageVersion.linkPreview]).not.toBeNull();
        expect(result.metadata.source!.sizeKB).toBe(0.01);
    });
});
