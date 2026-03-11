import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { downloadSourceImage } from '../../../src/image-data/http/downloadSourceImage';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

jest.mock('../../../src/helpers/httpRequest', () => ({
    __esModule: true,
    default: jest.fn(),
}));

const mockHttpRequest = require('../../../src/helpers/httpRequest').default as jest.Mock;

describe('downloadSourceImage', () => {
    let tempDir: string;

    beforeEach(async () => {
        jest.clearAllMocks();
        tempDir = await mkdtemp(join(tmpdir(), 'downloadSourceImage-'));
    });

    afterEach(async () => {
        try {
            await rm(tempDir, { recursive: true, force: true });
        } catch {
            // ignore
        }
    });

    it('downloads image, saves to temp dir with id and extension from URL, returns path', async () => {
        const imageDataId = '22222222-2222-2222-2222-222222222222';
        const sourceUrl = 'https://example.com/images/photo.png';
        const body = new ArrayBuffer(8);
        const mockResponse = { arrayBuffer: () => Promise.resolve(body) };
        mockHttpRequest.mockResolvedValue(mockResponse);

        const path = await downloadSourceImage(sourceUrl, tempDir, imageDataId);

        expect(mockHttpRequest).toHaveBeenCalledWith(sourceUrl, 5, undefined);
        expect(path).toBe(join(tempDir, `${imageDataId}-source.png`));
        const content = await readFile(path);
        expect(content).toEqual(Buffer.from(body));
    });

    it('passes abortSignal through to httpRequest when provided', async () => {
        const imageDataId = '22222222-2222-2222-2222-222222222222';
        const sourceUrl = 'https://example.com/images/photo.png';
        const abortSignal = new AbortController().signal;
        mockHttpRequest.mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) });

        await downloadSourceImage(sourceUrl, tempDir, imageDataId, abortSignal);

        expect(mockHttpRequest).toHaveBeenCalledWith(sourceUrl, 5, abortSignal);
    });

    it('uses jpg as default extension when URL has no extension', async () => {
        const imageDataId = '33333333-3333-3333-3333-333333333333';
        const sourceUrl = 'https://example.com/image';
        mockHttpRequest.mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) });

        const path = await downloadSourceImage(sourceUrl, tempDir, imageDataId);

        expect(mockHttpRequest).toHaveBeenCalledWith(sourceUrl, 5, undefined);
        expect(path).toBe(join(tempDir, `${imageDataId}-source.jpg`));
    });

    it('extracts extension from URL with query string', async () => {
        const imageDataId = '44444444-4444-4444-4444-444444444444';
        const sourceUrl = 'https://example.com/pic.jpeg?size=large';
        mockHttpRequest.mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) });

        const path = await downloadSourceImage(sourceUrl, tempDir, imageDataId);

        expect(mockHttpRequest).toHaveBeenCalledWith(sourceUrl, 5, undefined);
        expect(path).toContain('-source.jpeg');
    });
});
