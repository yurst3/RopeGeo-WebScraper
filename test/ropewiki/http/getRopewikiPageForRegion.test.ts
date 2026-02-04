import { describe, it, expect, afterEach, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import getRopewikiPageForRegion from '../../../src/ropewiki/http/getRopewikiPageForRegion';
import httpRequest from '../../../src/helpers/httpRequest';

jest.mock('../../../src/helpers/httpRequest', () => ({
    __esModule: true,
    default: jest.fn(),
}));

const responseFixturePath = path.join(__dirname, '..', 'data', 'ropewikiPageInfosResponse.json');
const responseFixture = JSON.parse(fs.readFileSync(responseFixturePath, 'utf-8'));
const expectedResultsPath = path.join(__dirname, '..', 'data', 'ropewikiPageInfos.json');
const expectedResults = JSON.parse(fs.readFileSync(expectedResultsPath, 'utf-8'));

// Create a mapping of region names to test UUIDs based on the regions in the expected results
const regionNameIds: {[name: string]: string} = {};
let regionCounter = 1;
expectedResults.forEach((result: { region: string }) => {
    if (result.region && !regionNameIds[result.region]) {
        regionNameIds[result.region] = `00000000-0000-0000-0000-${String(regionCounter).padStart(12, '0')}`;
        regionCounter++;
    }
});

const mockHttpRequest = jest.mocked(httpRequest);

describe('getRopewikiPageForRegion', () => {
    afterEach(() => {
        mockHttpRequest.mockClear();
    });

    it('returns RopewikiPage array when fetch succeeds', async () => {
        const region = 'World';
        const offset = 0;
        const limit = 10;
        mockHttpRequest.mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => responseFixture,
        } as Response);

        const pageInfos = await getRopewikiPageForRegion(region, offset, limit, regionNameIds);

        // Convert pageInfos to JSON-compatible format for comparison
        const reverseRegionMapping = Object.fromEntries(
            Object.entries(regionNameIds).map(([name, id]) => [id, name])
        );
        const normalizedPageInfos = JSON.parse(JSON.stringify(pageInfos, (key, value) => {
            if (value instanceof Date) {
                return value.toISOString();
            }
            if (key === 'region' && typeof value === 'string') {
                return reverseRegionMapping[value] || value;
            }
            return value;
        }));

        expect(normalizedPageInfos).toEqual(expectedResults);
        expect(mockHttpRequest).toHaveBeenCalledTimes(1);
    });

    it('throws when fetch returns an error status', async () => {
        const region = 'World';
        const offset = 0;
        const limit = 10;
        mockHttpRequest.mockRejectedValue(
            new Error('httpRequest non-OK: status=500 statusText=Internal Server Error')
        );

        const err = await getRopewikiPageForRegion(region, offset, limit, {}).catch((e) => e);
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toContain('Error getting pages info for region World offset 0 limit 10');
        expect((err as Error).message).toContain('500');
        expect(mockHttpRequest).toHaveBeenCalledTimes(1);
    });

    it('throws when fetch itself rejects', async () => {
        const region = 'World';
        const offset = 0;
        const limit = 10;
        mockHttpRequest.mockRejectedValue(new Error('network failure'));

        const err = await getRopewikiPageForRegion(region, offset, limit, {}).catch((e) => e);
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toContain('Error getting pages info for region World offset 0 limit 10');
        expect((err as Error).message).toContain('network failure');
        expect(mockHttpRequest).toHaveBeenCalledTimes(1);
    });

    it('throws when limit is greater than 2000', async () => {
        const region = 'World';
        const offset = 0;
        const limit = 2001;

        await expect(getRopewikiPageForRegion(region, offset, limit, {})).rejects.toThrow(
            'Limit must be less than or equal to 2000, got 2001'
        );
    });

    it('allows limit equal to 2000', async () => {
        const region = 'World';
        const offset = 0;
        const limit = 2000;
        mockHttpRequest.mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ results: {} }),
        } as Response);

        await getRopewikiPageForRegion(region, offset, limit, {});

        expect(mockHttpRequest).toHaveBeenCalledTimes(1);
    });

    it('throws when offset is greater than 5000', async () => {
        const region = 'World';
        const offset = 5001;
        const limit = 10;

        await expect(getRopewikiPageForRegion(region, offset, limit, {})).rejects.toThrow(
            'Offset must be less than or equal to 5000, got 5001'
        );
    });

    it('allows offset equal to 5000', async () => {
        const region = 'World';
        const offset = 5000;
        const limit = 10;
        mockHttpRequest.mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ results: {} }),
        } as Response);

        await getRopewikiPageForRegion(region, offset, limit, {});

        expect(mockHttpRequest).toHaveBeenCalledTimes(1);
    });

    it('allows limit equal to 2000 and offset equal to 5000', async () => {
        const region = 'World';
        const offset = 5000;
        const limit = 2000;
        mockHttpRequest.mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ results: {} }),
        } as Response);

        await getRopewikiPageForRegion(region, offset, limit, {});

        expect(mockHttpRequest).toHaveBeenCalledTimes(1);
    });
});
