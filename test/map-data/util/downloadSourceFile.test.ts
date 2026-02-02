import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { downloadSourceFile } from '../../../src/map-data/util/downloadSourceFile';
import { writeFile } from 'fs/promises';
import { join } from 'path';

// Mock fs/promises
jest.mock('fs/promises', () => ({
    writeFile: jest.fn(),
}));

// Mock global fetch
const mockFetch = jest.fn<typeof fetch>();
global.fetch = mockFetch as typeof fetch;

describe('downloadSourceFile', () => {
    const mockTempDir = '/tmp/map-data-abc123';
    const mockMapDataId = '11111111-1111-1111-1111-111111111111';
    const mockSourceFileUrl = 'https://example.com/file.kml';
    const mockSourceFileContent = '<?xml version="1.0"?><kml></kml>';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('successfully downloads and saves a KML file', async () => {
        const mockText = jest.fn<() => Promise<string>>().mockResolvedValue(mockSourceFileContent);
        mockFetch.mockResolvedValue({
            ok: true,
            text: mockText,
        } as unknown as Response);
        (writeFile as jest.MockedFunction<typeof writeFile>).mockResolvedValue(undefined);

        const result = await downloadSourceFile(mockSourceFileUrl, mockTempDir, mockMapDataId, true);

        expect(result).toEqual({
            filePath: join(mockTempDir, `${mockMapDataId}.kml`),
            content: mockSourceFileContent,
        });
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith(
            mockSourceFileUrl,
            expect.objectContaining({ headers: expect.any(Object) }),
        );
        expect(writeFile).toHaveBeenCalledTimes(1);
        expect(writeFile).toHaveBeenCalledWith(
            join(mockTempDir, `${mockMapDataId}.kml`),
            mockSourceFileContent,
            'utf-8',
        );
    });

    it('successfully downloads and saves a GPX file', async () => {
        const mockText = jest.fn<() => Promise<string>>().mockResolvedValue(mockSourceFileContent);
        mockFetch.mockResolvedValue({
            ok: true,
            text: mockText,
        } as unknown as Response);
        (writeFile as jest.MockedFunction<typeof writeFile>).mockResolvedValue(undefined);

        const result = await downloadSourceFile(mockSourceFileUrl, mockTempDir, mockMapDataId, false);

        expect(result).toEqual({
            filePath: join(mockTempDir, `${mockMapDataId}.gpx`),
            content: mockSourceFileContent,
        });
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith(
            mockSourceFileUrl,
            expect.objectContaining({ headers: expect.any(Object) }),
        );
        expect(writeFile).toHaveBeenCalledWith(
            join(mockTempDir, `${mockMapDataId}.gpx`),
            mockSourceFileContent,
            'utf-8',
        );
    });

    it('throws error when fetch response is not ok', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            url: mockSourceFileUrl,
            headers: { get: () => null },
            clone: () => ({ text: () => Promise.resolve('Not Found') }),
        } as unknown as Response);

        const err = await downloadSourceFile(mockSourceFileUrl, mockTempDir, mockMapDataId, true).catch((e) => e);
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toContain('httpRequest non-OK');
        expect((err as Error).message).toContain('404');
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(writeFile).not.toHaveBeenCalled();
    });

    it('throws error when fetch throws an error', async () => {
        const fetchError = new Error('Network error');
        mockFetch.mockRejectedValue(fetchError);

        const err = await downloadSourceFile(mockSourceFileUrl, mockTempDir, mockMapDataId, true).catch((e) => e);
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toContain('httpRequest failed');
        expect((err as Error).message).toContain('Network error');
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(writeFile).not.toHaveBeenCalled();
    });

    it('throws error when writeFile throws an error', async () => {
        const mockText = jest.fn<() => Promise<string>>().mockResolvedValue(mockSourceFileContent);
        mockFetch.mockResolvedValue({
            ok: true,
            text: mockText,
        } as unknown as Response);
        const writeError = new Error('File system error');
        (writeFile as jest.MockedFunction<typeof writeFile>).mockRejectedValue(writeError);

        await expect(downloadSourceFile(mockSourceFileUrl, mockTempDir, mockMapDataId, true)).rejects.toThrow(
            'File system error'
        );
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(writeFile).toHaveBeenCalledTimes(1);
    });

    it('throws error when text() throws an error', async () => {
        const textError = new Error('Text parsing error');
        const mockText = jest.fn<() => Promise<string>>().mockRejectedValue(textError);
        mockFetch.mockResolvedValue({
            ok: true,
            text: mockText,
        } as unknown as Response);

        await expect(downloadSourceFile(mockSourceFileUrl, mockTempDir, mockMapDataId, true)).rejects.toThrow(
            'Text parsing error'
        );
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(writeFile).not.toHaveBeenCalled();
    });

    it('throws error for non-Error thrown values', async () => {
        mockFetch.mockRejectedValue('String error');

        const err = await downloadSourceFile(mockSourceFileUrl, mockTempDir, mockMapDataId, true).catch((e) => e);
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toContain('httpRequest failed');
        expect((err as Error).message).toContain('String error');
    });
});
