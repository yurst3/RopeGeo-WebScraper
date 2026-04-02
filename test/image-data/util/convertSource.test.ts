import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ImageVersion } from 'ropegeo-common/classes';
import { convertSource } from '../../../src/image-data/util/convertSource';
import { Metadata } from '../../../src/image-data/types/metadata';
import { ALL_IMAGE_VERSIONS } from '../../../src/image-data/util/imageVersionFile';

jest.mock('../../../src/image-data/util/runSourceConversionPipeline', () => ({
    runSourceConversionPipeline: jest.fn(),
}));

jest.mock('fs', () => ({ existsSync: jest.fn() }));

const mockRunPipeline = require('../../../src/image-data/util/runSourceConversionPipeline')
    .runSourceConversionPipeline as jest.MockedFunction<
    typeof import('../../../src/image-data/util/runSourceConversionPipeline').runSourceConversionPipeline
>;
const existsSyncMock = require('fs').existsSync as jest.MockedFunction<typeof import('fs').existsSync>;

describe('convertSource', () => {
    const versions = ALL_IMAGE_VERSIONS;
    const metadata = new Metadata();

    beforeEach(() => {
        jest.clearAllMocks();
        const buffers = {
            [ImageVersion.preview]: Buffer.from([1]),
            [ImageVersion.linkPreview]: Buffer.from([2]),
            [ImageVersion.banner]: Buffer.from([3]),
            [ImageVersion.full]: Buffer.from([4]),
            [ImageVersion.lossless]: Buffer.from([5]),
        };
        mockRunPipeline.mockResolvedValue({ buffers, metadata });
    });

    it('calls runSourceConversionPipeline when abortSignal is not provided', async () => {
        const source = Buffer.from('x');
        const result = await convertSource(source, versions);

        expect(mockRunPipeline).toHaveBeenCalledWith(source, versions, undefined);
        expect(result.buffers[ImageVersion.preview]).toEqual(Buffer.from([1]));
        expect(result.metadata).toBe(metadata);
    });

    it('forwards existingMetadata to runSourceConversionPipeline', async () => {
        const source = Buffer.from('x');
        const existing = new Metadata();
        await convertSource(source, versions, undefined, existing);

        expect(mockRunPipeline).toHaveBeenCalledWith(source, versions, existing);
    });

    it('when worker missing, rejects with convertSourceWorker message', async () => {
        existsSyncMock.mockReturnValue(false);
        const controller = new AbortController();

        await expect(convertSource('/path/to/source.jpg', versions, controller.signal)).rejects.toThrow(
            /convertSourceWorker not found at .*; build the ImageProcessor artifact to include the worker/,
        );
    });
});
