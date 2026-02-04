import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { downloadSourceFile } from '../../../src/map-data/util/downloadSourceFile';
import httpRequest from '../../../src/helpers/httpRequest';
import { writeFile } from 'fs/promises';
import { join } from 'path';

jest.mock('../../../src/helpers/httpRequest', () => ({
    __esModule: true,
    default: jest.fn(),
}));

// Mock fs/promises
jest.mock('fs/promises', () => ({
    writeFile: jest.fn(),
}));

const mockHttpRequest = jest.mocked(httpRequest);

describe('downloadSourceFile', () => {
    const mockTempDir = '/tmp/map-data-abc123';
    const mockMapDataId = '11111111-1111-1111-1111-111111111111';
    const mockSourceFileUrl = 'https://example.com/file.kml';
    const mockSourceFileContent = '<?xml version="1.0"?><kml></kml>';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('successfully downloads and saves a KML file', async () => {
        mockHttpRequest.mockResolvedValue({
            ok: true,
            text: () => Promise.resolve(mockSourceFileContent),
        } as unknown as Response);
        (writeFile as jest.MockedFunction<typeof writeFile>).mockResolvedValue(undefined);

        const result = await downloadSourceFile(mockSourceFileUrl, mockTempDir, mockMapDataId, true);

        expect(result).toEqual({
            filePath: join(mockTempDir, `${mockMapDataId}.kml`),
            content: mockSourceFileContent,
        });
        expect(mockHttpRequest).toHaveBeenCalledTimes(1);
        expect(mockHttpRequest).toHaveBeenCalledWith(mockSourceFileUrl);
        expect(writeFile).toHaveBeenCalledTimes(1);
        expect(writeFile).toHaveBeenCalledWith(
            join(mockTempDir, `${mockMapDataId}.kml`),
            mockSourceFileContent,
            'utf-8',
        );
    });

    it('successfully downloads and saves a GPX file', async () => {
        mockHttpRequest.mockResolvedValue({
            ok: true,
            text: () => Promise.resolve(mockSourceFileContent),
        } as unknown as Response);
        (writeFile as jest.MockedFunction<typeof writeFile>).mockResolvedValue(undefined);

        const result = await downloadSourceFile(mockSourceFileUrl, mockTempDir, mockMapDataId, false);

        expect(result).toEqual({
            filePath: join(mockTempDir, `${mockMapDataId}.gpx`),
            content: mockSourceFileContent,
        });
        expect(mockHttpRequest).toHaveBeenCalledTimes(1);
        expect(mockHttpRequest).toHaveBeenCalledWith(mockSourceFileUrl);
        expect(writeFile).toHaveBeenCalledWith(
            join(mockTempDir, `${mockMapDataId}.gpx`),
            mockSourceFileContent,
            'utf-8',
        );
    });

    it('throws error when fetch response is not ok', async () => {
        mockHttpRequest.mockRejectedValue(
            new Error('httpRequest non-OK: status=404 statusText=Not Found')
        );

        const err = await downloadSourceFile(mockSourceFileUrl, mockTempDir, mockMapDataId, true).catch((e) => e);
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toContain('httpRequest non-OK');
        expect((err as Error).message).toContain('404');
        expect(mockHttpRequest).toHaveBeenCalledTimes(1);
        expect(writeFile).not.toHaveBeenCalled();
    });

    it('throws error when fetch throws an error', async () => {
        mockHttpRequest.mockRejectedValue(new Error('httpRequest failed: Network error'));

        const err = await downloadSourceFile(mockSourceFileUrl, mockTempDir, mockMapDataId, true).catch((e) => e);
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toContain('httpRequest failed');
        expect((err as Error).message).toContain('Network error');
        expect(mockHttpRequest).toHaveBeenCalledTimes(1);
        expect(writeFile).not.toHaveBeenCalled();
    });

    it('throws error when writeFile throws an error', async () => {
        mockHttpRequest.mockResolvedValue({
            ok: true,
            text: () => Promise.resolve(mockSourceFileContent),
        } as unknown as Response);
        const writeError = new Error('File system error');
        (writeFile as jest.MockedFunction<typeof writeFile>).mockRejectedValue(writeError);

        await expect(downloadSourceFile(mockSourceFileUrl, mockTempDir, mockMapDataId, true)).rejects.toThrow(
            'File system error'
        );
        expect(mockHttpRequest).toHaveBeenCalledTimes(1);
        expect(writeFile).toHaveBeenCalledTimes(1);
    });

    it('throws error when text() throws an error', async () => {
        const textError = new Error('Text parsing error');
        mockHttpRequest.mockResolvedValue({
            ok: true,
            text: () => Promise.reject(textError),
        } as unknown as Response);

        await expect(downloadSourceFile(mockSourceFileUrl, mockTempDir, mockMapDataId, true)).rejects.toThrow(
            'Text parsing error'
        );
        expect(mockHttpRequest).toHaveBeenCalledTimes(1);
        expect(writeFile).not.toHaveBeenCalled();
    });

    it('throws error for non-Error thrown values', async () => {
        mockHttpRequest.mockRejectedValue(new Error('httpRequest failed: String error'));

        const err = await downloadSourceFile(mockSourceFileUrl, mockTempDir, mockMapDataId, true).catch((e) => e);
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toContain('httpRequest failed');
        expect((err as Error).message).toContain('String error');
    });
});
