import { describe, it, expect, afterEach, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import getRopewikiPageHtml from '../../../src/ropewiki/http/getRopewikiPageHtml';

const fixturePath = path.join(__dirname, '..', 'data', 'regions', 'ropewikiRegionsResponse.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

type MockFetch = ReturnType<typeof jest.fn<typeof fetch>>;

describe('getRopewikiPageHtml', () => {
    afterEach(() => {
        const mockFetch = globalThis.fetch as MockFetch | undefined;
        if (mockFetch && typeof mockFetch.mockClear === 'function') {
            mockFetch.mockClear();
        }
        // @ts-expect-error clear test double
        globalThis.fetch = undefined;
    });

    it('returns HTML when fetch succeeds', async () => {
        const regionPageId = '5597';
        const mockFetch = jest.fn<typeof fetch>().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => fixture,
        } as Response);
        globalThis.fetch = mockFetch as unknown as typeof fetch;

        const html = await getRopewikiPageHtml(regionPageId);

        expect(html).toBe(fixture.parse.text['*']);
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws when fetch returns an error status', async () => {
        const regionPageId = '5597';
        const mockErrorBody = 'Something went wrong!';
        const mockFetch = jest.fn<typeof fetch>().mockResolvedValue({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            url: 'http://ropewiki.com/api.php',
            headers: { get: () => null },
            clone: () => ({ text: () => Promise.resolve(mockErrorBody) }),
            text: () => Promise.resolve(mockErrorBody),
        } as Response);
        globalThis.fetch = mockFetch as unknown as typeof fetch;

        await expect(getRopewikiPageHtml(regionPageId)).rejects.toThrow(
            'Error getting regions html: 500 Internal Server Error'
        );
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws when fetch itself rejects', async () => {
        const regionPageId = '5597';
        const mockFetch = jest.fn<typeof fetch>().mockRejectedValue(new Error('network failure'));
        globalThis.fetch = mockFetch as unknown as typeof fetch;

        await expect(getRopewikiPageHtml(regionPageId)).rejects.toThrow(
            'Error getting regions html: Error: network failure'
        );
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });
});

