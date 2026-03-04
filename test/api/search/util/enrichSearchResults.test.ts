import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SearchCursor } from 'ropegeo-common';
import { enrichSearchResults } from '../../../../src/api/search/util/enrichSearchResults';
import type { PageRow } from '../../../../src/api/search/database/getPageRowsByIds';
import type { RegionRow } from '../../../../src/api/search/converters/regionToRegionPreview';

const mockConn = {} as import('zapatos/db').Queryable;

let mockGetRopewikiRegionLineage: jest.MockedFunction<
    typeof import('../../../../src/ropewiki/database/getRopewikiRegionLineage').default
>;
let mockGetRegionBannerUrls: jest.MockedFunction<
    typeof import('../../../../src/api/search/database/getRegionBannerUrls').default
>;

jest.mock('../../../../src/ropewiki/database/getRopewikiRegionLineage', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../../src/api/search/database/getRegionBannerUrls', () => ({
    __esModule: true,
    default: jest.fn(),
}));

function makePageRow(overrides: Partial<PageRow> & { pageId: string; regionId: string }): PageRow {
    return {
        pageId: overrides.pageId,
        title: overrides.title ?? 'Test Page',
        quality: overrides.quality ?? null,
        userVotes: overrides.userVotes ?? null,
        technicalRating: overrides.technicalRating ?? null,
        timeRating: overrides.timeRating ?? null,
        waterRating: overrides.waterRating ?? null,
        riskRating: overrides.riskRating ?? null,
        regionId: overrides.regionId,
        regionName: overrides.regionName ?? 'Test Region',
        bannerFileUrl: overrides.bannerFileUrl ?? null,
        url: overrides.url ?? null,
        permits: overrides.permits ?? null,
        mapData: overrides.mapData ?? null,
    };
}

function makeRegionRow(overrides: Partial<RegionRow> & { id: string }): RegionRow {
    return {
        id: overrides.id,
        name: overrides.name ?? 'Test Region',
        url: overrides.url ?? 'https://example.com/region',
        pageCount: overrides.pageCount ?? 0,
    };
}

describe('enrichSearchResults', () => {
    const pageId = 'a1000001-0001-4000-8000-000000000001';
    const regionId = 'b1000001-0001-4000-8000-000000000001';
    const regionId2 = 'b1000002-0002-4000-8000-000000000002';

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetRopewikiRegionLineage =
            require('../../../../src/ropewiki/database/getRopewikiRegionLineage').default;
        mockGetRegionBannerUrls =
            require('../../../../src/api/search/database/getRegionBannerUrls').default;
        mockGetRopewikiRegionLineage.mockResolvedValue([]);
        mockGetRegionBannerUrls.mockResolvedValue(new Map());
    });

    it('returns empty array when items is empty', async () => {
        const result = await enrichSearchResults(
            mockConn,
            [],
            new Map(),
            new Map(),
        );
        expect(result).toEqual([]);
        expect(mockGetRopewikiRegionLineage).not.toHaveBeenCalled();
        expect(mockGetRegionBannerUrls).not.toHaveBeenCalled();
    });

    it('returns PagePreview for page item with lineage as regions', async () => {
        const items: SearchCursor[] = [
            new SearchCursor(0.9, 'page', pageId),
        ];
        const pageRowsById = new Map<string, PageRow>([
            [pageId, makePageRow({ pageId, regionId, regionName: 'Child Region', title: 'My Page' })],
        ]);
        mockGetRopewikiRegionLineage.mockResolvedValue([
            { id: regionId, name: 'Child Region' },
            { id: regionId2, name: 'Parent Region' },
        ]);

        const result = await enrichSearchResults(
            mockConn,
            items,
            pageRowsById,
            new Map(),
        );

        expect(result.length).toBe(1);
        const page = result[0]!;
        expect('title' in page).toBe(true);
        expect(page.id).toBe(pageId);
        expect(page.title).toBe('My Page');
        expect(page.regions).toEqual(['Child Region', 'Parent Region']);
    });

    it('uses regionName when lineage is empty for page', async () => {
        const items: SearchCursor[] = [
            new SearchCursor(0.9, 'page', pageId),
        ];
        const pageRowsById = new Map<string, PageRow>([
            [pageId, makePageRow({ pageId, regionId, regionName: 'Solo Region', title: 'Page' })],
        ]);
        mockGetRopewikiRegionLineage.mockResolvedValue([]);

        const result = await enrichSearchResults(
            mockConn,
            items,
            pageRowsById,
            new Map(),
        );

        expect(result.length).toBe(1);
        const page = result[0]!;
        expect(page.regions).toEqual(['Solo Region']);
    });

    it('returns RegionPreview for region item with parents and imageUrl', async () => {
        const items: SearchCursor[] = [
            new SearchCursor(0.8, 'region', regionId),
        ];
        const regionRowsById = new Map<string, RegionRow>([
            [regionId, makeRegionRow({ id: regionId, name: 'Child', pageCount: 5 })],
        ]);
        mockGetRopewikiRegionLineage.mockResolvedValue([
            { id: regionId, name: 'Child' },
            { id: regionId2, name: 'Parent' },
        ]);
        mockGetRegionBannerUrls.mockResolvedValue(
            new Map([[regionId, 'https://example.com/banner.jpg']]),
        );

        const result = await enrichSearchResults(
            mockConn,
            items,
            new Map(),
            regionRowsById,
        );

        expect(result.length).toBe(1);
        const region = result[0]!;
        expect('parents' in region).toBe(true);
        expect(region.id).toBe(regionId);
        expect(region.name).toBe('Child');
        expect(region.parents).toEqual(['Parent']);
        expect(region.imageUrl).toBe('https://example.com/banner.jpg');
        expect(region.pageCount).toBe(5);
    });

    it('skips items with missing row and preserves order', async () => {
        const otherPageId = 'a1000002-0002-4000-8000-000000000002';
        const items: SearchCursor[] = [
            new SearchCursor(0.9, 'page', pageId),
            new SearchCursor(0.8, 'page', otherPageId),
            new SearchCursor(0.7, 'region', regionId),
        ];
        const pageRowsById = new Map<string, PageRow>([
            [pageId, makePageRow({ pageId, regionId, title: 'First' })],
        ]);
        const regionRowsById = new Map<string, RegionRow>([
            [regionId, makeRegionRow({ id: regionId })],
        ]);
        mockGetRopewikiRegionLineage.mockResolvedValue([]);

        const result = await enrichSearchResults(
            mockConn,
            items,
            pageRowsById,
            regionRowsById,
        );

        expect(result.length).toBe(2);
        expect((result[0] as { title?: string }).title).toBe('First');
        expect((result[1] as { name?: string }).name).toBe('Test Region');
    });

    it('returns results in same order as items', async () => {
        const items: SearchCursor[] = [
            new SearchCursor(0.7, 'region', regionId),
            new SearchCursor(0.9, 'page', pageId),
        ];
        const pageRowsById = new Map<string, PageRow>([
            [pageId, makePageRow({ pageId, regionId, title: 'Page' })],
        ]);
        const regionRowsById = new Map<string, RegionRow>([
            [regionId, makeRegionRow({ id: regionId, name: 'Region' })],
        ]);
        mockGetRopewikiRegionLineage.mockResolvedValue([]);

        const result = await enrichSearchResults(
            mockConn,
            items,
            pageRowsById,
            regionRowsById,
        );

        expect(result.length).toBe(2);
        expect((result[0] as { name?: string }).name).toBe('Region');
        expect((result[1] as { title?: string }).title).toBe('Page');
    });
});
