import { describe, it, expect, afterEach, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import getRegions from '../../../src/ropewiki/http/getRegions';
import { RopewikiRegion } from '../../../src/ropewiki/types/region';

const responseFixturePath = path.join(__dirname, '..', 'data', 'ropewikiRegionsResponse.json');
const responseFixture = JSON.parse(fs.readFileSync(responseFixturePath, 'utf-8'));

type MockFetch = ReturnType<typeof jest.fn<typeof fetch>>;

describe('getRegions', () => {
    afterEach(() => {
        const mockFetch = globalThis.fetch as MockFetch | undefined;
        if (mockFetch && typeof mockFetch.mockClear === 'function') {
            mockFetch.mockClear();
        }
        // @ts-expect-error clear test double
        globalThis.fetch = undefined;
    });

    it('returns RopewikiRegion array when fetch succeeds', async () => {
        const mockFetch = jest.fn<typeof fetch>().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => responseFixture,
        } as Response);
        globalThis.fetch = mockFetch as unknown as typeof fetch;

        const regions = await getRegions();

        expect(regions).toHaveLength(4);
        expect(regions).toBeInstanceOf(Array);
        expect(regions[0]).toBeInstanceOf(RopewikiRegion);

        // Verify the first region (Zion West Side)
        const zionWestSide = regions.find(r => r.name === 'Zion West Side');
        expect(zionWestSide).toBeDefined();
        expect(zionWestSide!.parentRegion).toBe('Zion National Park');
        expect(zionWestSide!.pageCount).toBe(15);
        expect(zionWestSide!.level).toBe(7);
        expect(zionWestSide!.overview).toBeUndefined();
        expect(zionWestSide!.bestMonths).toEqual([]);
        expect(zionWestSide!.isMajorRegion).toBe(false);
        expect(zionWestSide!.isTopLevelRegion).toBe(false);
        expect(zionWestSide!.latestRevisionDate).toEqual(new Date(1709239731 * 1000));
        expect(zionWestSide!.url).toBe('https://ropewiki.com/Zion_West_Side');

        // Verify Zion National Park has overview
        const zionNationalPark = regions.find(r => r.name === 'Zion National Park');
        expect(zionNationalPark).toBeDefined();
        expect(zionNationalPark!.parentRegion).toBe('Southwest Utah');
        expect(zionNationalPark!.pageCount).toBe(86);
        expect(zionNationalPark!.level).toBe(6);
        expect(zionNationalPark!.overview).toBe('Zion National Park and surrounding region consists of many classic and picturesque sandstone slot canyons.');
        expect(zionNationalPark!.bestMonths).toEqual([]);
        expect(zionNationalPark!.isMajorRegion).toBe(false);
        expect(zionNationalPark!.isTopLevelRegion).toBe(false);
        expect(zionNationalPark!.latestRevisionDate).toEqual(new Date(1709238662 * 1000));
        expect(zionNationalPark!.url).toBe('https://ropewiki.com/Zion_National_Park');

        // Verify all regions are parsed correctly
        const zionMainCanyon = regions.find(r => r.name === 'Zion Main Canyon');
        expect(zionMainCanyon).toBeDefined();
        expect(zionMainCanyon!.parentRegion).toBe('Zion National Park');
        expect(zionMainCanyon!.pageCount).toBe(17);
        expect(zionMainCanyon!.url).toBe('https://ropewiki.com/Zion_Main_Canyon');

        const zionEastSide = regions.find(r => r.name === 'Zion East Side');
        expect(zionEastSide).toBeDefined();
        expect(zionEastSide!.parentRegion).toBe('Zion National Park');
        expect(zionEastSide!.pageCount).toBe(37);
        expect(zionEastSide!.url).toBe('https://ropewiki.com/Zion_East_Side');

        expect(mockFetch).toHaveBeenCalledTimes(1);
        
        // Verify the URL was constructed correctly
        const fetchCall = mockFetch.mock.calls[0]![0] as URL;
        expect(fetchCall.toString()).toContain('ropewiki.com/index.php');
        expect(fetchCall.searchParams.get('title')).toBe('Special:Ask');
        expect(fetchCall.searchParams.get('format')).toBe('json');
        expect(fetchCall.searchParams.get('limit')).toBe('2000');
    });

    it('returns empty array when response has no results', async () => {
        const mockFetch = jest.fn<typeof fetch>().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ results: {} }),
        } as Response);
        globalThis.fetch = mockFetch as unknown as typeof fetch;

        const regions = await getRegions();

        expect(regions).toEqual([]);
        expect(regions).toHaveLength(0);
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws when fetch returns an error status', async () => {
        const mockErrorBody = 'mock error body';
        const mockFetch = jest.fn<typeof fetch>().mockResolvedValue({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            url: 'https://ropewiki.com/index.php',
            headers: { get: () => null },
            clone: () => ({ text: () => Promise.resolve(mockErrorBody) }),
        } as Response);
        globalThis.fetch = mockFetch as unknown as typeof fetch;

        const err = await getRegions().catch((e) => e);
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toContain('Error getting regions');
        expect((err as Error).message).toContain('500');
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws when fetch itself rejects', async () => {
        const mockFetch = jest.fn<typeof fetch>().mockRejectedValue(new Error('network failure'));
        globalThis.fetch = mockFetch as unknown as typeof fetch;

        const err = await getRegions().catch((e) => e);
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toContain('Error getting regions');
        expect((err as Error).message).toContain('network failure');
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('constructs URL with correct query parameters', async () => {
        const mockFetch = jest.fn<typeof fetch>().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ results: {} }),
        } as Response);
        globalThis.fetch = mockFetch as unknown as typeof fetch;

        await getRegions();

        const fetchCall = mockFetch.mock.calls[0]![0] as URL;
        const url = new URL(fetchCall.toString());

        expect(url.hostname).toBe('ropewiki.com');
        expect(url.pathname).toBe('/index.php');
        expect(url.searchParams.get('title')).toBe('Special:Ask');
        expect(url.searchParams.get('format')).toBe('json');
        expect(url.searchParams.get('limit')).toBe('2000');
        expect(url.searchParams.get('x')).toContain('Category:Regions');
        
        // Verify the x parameter contains encoded printouts
        // Note: The encode function replaces % with -, so %20 becomes -20
        const xParam = url.searchParams.get('x');
        expect(xParam).toContain('Max-20Modification-20date');
        expect(xParam).toContain('Located-20in-20region');
        expect(xParam).toContain('Has-20location-20count');
    });

    it('parses all regions from the test fixture correctly', async () => {
        const mockFetch = jest.fn<typeof fetch>().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => responseFixture,
        } as Response);
        globalThis.fetch = mockFetch as unknown as typeof fetch;

        const regions = await getRegions();

        // Should have all 4 regions from the fixture
        const regionNames = regions.map(r => r.name);
        expect(regionNames.sort()).toEqual([
            'Zion East Side',
            'Zion Main Canyon',
            'Zion National Park',
            'Zion West Side',
        ].sort());

        // Verify all regions are RopewikiRegion instances
        regions.forEach(region => {
            expect(region).toBeInstanceOf(RopewikiRegion);
            expect(region.name).toBeTruthy();
            expect(typeof region.pageCount).toBe('number');
            expect(typeof region.level).toBe('number');
            expect(typeof region.isMajorRegion).toBe('boolean');
            expect(typeof region.isTopLevelRegion).toBe('boolean');
            expect(region.latestRevisionDate).toBeInstanceOf(Date);
            expect(Array.isArray(region.bestMonths)).toBe(true);
        });
    });
});
