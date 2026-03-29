import { describe, it, expect, afterEach, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import getRegions from '../../../src/ropewiki/http/getRegions';
import httpRequest from 'ropegeo-common/helpers/httpRequest';
import { RopewikiRegion } from '../../../src/ropewiki/types/region';

jest.mock('ropegeo-common/helpers/httpRequest', () => ({
    __esModule: true,
    default: jest.fn(),
}));

const responseFixturePath = path.join(__dirname, '..', 'data', 'ropewikiRegionsResponse.json');
const responseFixture = JSON.parse(fs.readFileSync(responseFixturePath, 'utf-8'));

const mockHttpRequest = jest.mocked(httpRequest);

describe('getRegions', () => {
    afterEach(() => {
        mockHttpRequest.mockClear();
    });

    it('returns RopewikiRegion array when fetch succeeds', async () => {
        mockHttpRequest.mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => responseFixture,
        } as Response);

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

        expect(mockHttpRequest).toHaveBeenCalledTimes(1);

        // Verify the URL was constructed correctly
        const urlArg = mockHttpRequest.mock.calls[0]![0] as URL;
        expect(urlArg.toString()).toContain('ropewiki.com/index.php');
        expect(urlArg.searchParams.get('title')).toBe('Special:Ask');
        expect(urlArg.searchParams.get('format')).toBe('json');
        expect(urlArg.searchParams.get('limit')).toBe('2000');
    });

    it('returns empty array when response has no results', async () => {
        mockHttpRequest.mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ results: {} }),
        } as Response);

        const regions = await getRegions();

        expect(regions).toEqual([]);
        expect(regions).toHaveLength(0);
        expect(mockHttpRequest).toHaveBeenCalledTimes(1);
    });

    it('throws when fetch returns an error status', async () => {
        mockHttpRequest.mockRejectedValue(
            new Error('httpRequest non-OK: status=500 statusText=Internal Server Error')
        );

        const err = await getRegions().catch((e) => e);
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toContain('Error getting regions');
        expect((err as Error).message).toContain('500');
        expect(mockHttpRequest).toHaveBeenCalledTimes(1);
    });

    it('throws when fetch itself rejects', async () => {
        mockHttpRequest.mockRejectedValue(new Error('network failure'));

        const err = await getRegions().catch((e) => e);
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toContain('Error getting regions');
        expect((err as Error).message).toContain('network failure');
        expect(mockHttpRequest).toHaveBeenCalledTimes(1);
    });

    it('constructs URL with correct query parameters', async () => {
        mockHttpRequest.mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ results: {} }),
        } as Response);

        await getRegions();

        const urlArg = mockHttpRequest.mock.calls[0]![0] as URL;
        const url = typeof urlArg === 'string' ? new URL(urlArg) : urlArg;

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
        mockHttpRequest.mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => responseFixture,
        } as Response);

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
