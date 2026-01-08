import { describe, it, expect, afterEach, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import getRopewikiPageInfoForRegion from '../../http/getRopewikiPageInfoForRegion';

const responseFixturePath = path.join(__dirname, '..', 'data', 'ropewikiPageInfosResponse.json');
const responseFixture = JSON.parse(fs.readFileSync(responseFixturePath, 'utf-8'));
const expectedResultsPath = path.join(__dirname, '..', 'data', 'ropewikiPageInfos.json');
const expectedResults = JSON.parse(fs.readFileSync(expectedResultsPath, 'utf-8'));

type MockFetch = ReturnType<typeof jest.fn<typeof fetch>>;

describe('getRopewikiPageInfoForRegion', () => {
    afterEach(() => {
        const mockFetch = globalThis.fetch as MockFetch | undefined;
        if (mockFetch && typeof mockFetch.mockClear === 'function') {
            mockFetch.mockClear();
        }
        // @ts-expect-error clear test double
        globalThis.fetch = undefined;
    });

    it('returns RopewikiPageInfo array when fetch succeeds', async () => {
        const region = 'World';
        const offset = 0;
        const limit = 10;
        const mockFetch = jest.fn<typeof fetch>().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => responseFixture,
        } as Response);
        globalThis.fetch = mockFetch as unknown as typeof fetch;

        const pageInfos = await getRopewikiPageInfoForRegion(region, offset, limit);

        // Convert pageInfos to JSON-compatible format for comparison
        // Serialize and parse to normalize Date objects and remove undefined properties
        const normalizedPageInfos = JSON.parse(JSON.stringify(pageInfos, (key, value) => {
            // Convert Date objects to ISO strings
            if (value instanceof Date) {
                return value.toISOString();
            }
            // JSON.stringify already omits undefined, so we don't need to handle that
            return value;
        }));

        expect(normalizedPageInfos).toEqual(expectedResults);
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws when fetch returns an error status', async () => {
        const region = 'World';
        const offset = 0;
        const limit = 10;
        const mockFetch = jest.fn<typeof fetch>().mockResolvedValue({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
        } as Response);
        globalThis.fetch = mockFetch as unknown as typeof fetch;

        await expect(getRopewikiPageInfoForRegion(region, offset, limit)).rejects.toThrow(
            'Error getting pages info for region World offset 0 limit 10: 500 Internal Server Error'
        );
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws when fetch itself rejects', async () => {
        const region = 'World';
        const offset = 0;
        const limit = 10;
        const mockFetch = jest.fn<typeof fetch>().mockRejectedValue(new Error('network failure'));
        globalThis.fetch = mockFetch as unknown as typeof fetch;

        await expect(getRopewikiPageInfoForRegion(region, offset, limit)).rejects.toThrow(
            'Error getting pages info for region World offset 0 limit 10: Error: network failure'
        );
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws when limit is greater than 2000', async () => {
        const region = 'World';
        const offset = 0;
        const limit = 2001;

        await expect(getRopewikiPageInfoForRegion(region, offset, limit)).rejects.toThrow(
            'Limit must be less than or equal to 2000, got 2001'
        );
    });

    it('allows limit equal to 2000', async () => {
        const region = 'World';
        const offset = 0;
        const limit = 2000;
        const mockFetch = jest.fn<typeof fetch>().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ results: {} }),
        } as Response);
        globalThis.fetch = mockFetch as unknown as typeof fetch;

        await getRopewikiPageInfoForRegion(region, offset, limit);

        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws when offset is greater than 5000', async () => {
        const region = 'World';
        const offset = 5001;
        const limit = 10;

        await expect(getRopewikiPageInfoForRegion(region, offset, limit)).rejects.toThrow(
            'Offset must be less than or equal to 5000, got 5001'
        );
    });

    it('allows offset equal to 5000', async () => {
        const region = 'World';
        const offset = 5000;
        const limit = 10;
        const mockFetch = jest.fn<typeof fetch>().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ results: {} }),
        } as Response);
        globalThis.fetch = mockFetch as unknown as typeof fetch;

        await getRopewikiPageInfoForRegion(region, offset, limit);

        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('allows limit equal to 2000 and offset equal to 5000', async () => {
        const region = 'World';
        const offset = 5000;
        const limit = 2000;
        const mockFetch = jest.fn<typeof fetch>().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ results: {} }),
        } as Response);
        globalThis.fetch = mockFetch as unknown as typeof fetch;

        await getRopewikiPageInfoForRegion(region, offset, limit);

        expect(mockFetch).toHaveBeenCalledTimes(1);
    });
});

