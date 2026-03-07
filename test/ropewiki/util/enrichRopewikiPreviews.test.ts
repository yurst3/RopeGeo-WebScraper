import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
    enrichRopewikiPreviews,
    type RopewikiPreviewPageRow,
    type RopewikiPreviewRegionRow,
} from '../../../src/ropewiki/util/enrichRopewikiPreviews';

const mockConn = {} as import('zapatos/db').Queryable;

let mockGetRopewikiRegionLineage: jest.MockedFunction<
    typeof import('../../../src/ropewiki/database/getRopewikiRegionLineage').default
>;
let mockGetRegionBannerUrls: jest.MockedFunction<
    typeof import('../../../src/ropewiki/database/getRegionBannerUrls').default
>;

jest.mock('../../../src/ropewiki/database/getRopewikiRegionLineage', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../src/ropewiki/database/getRegionBannerUrls', () => ({
    __esModule: true,
    default: jest.fn(),
}));

function makePageRow(
    overrides: Partial<RopewikiPreviewPageRow> & { pageId: string; regionId: string },
): RopewikiPreviewPageRow {
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
        aka: overrides.aka ?? [],
    };
}

function makeRegionRow(
    overrides: Partial<RopewikiPreviewRegionRow> & { id: string },
): RopewikiPreviewRegionRow {
    return {
        id: overrides.id,
        name: overrides.name ?? 'Test Region',
        pageCount: overrides.pageCount ?? 0,
        regionCount: overrides.regionCount ?? 0,
    };
}

describe('enrichRopewikiPreviews', () => {
    const pageId = 'a1000001-0001-4000-8000-000000000001';
    const regionId = 'b1000001-0001-4000-8000-000000000001';
    const regionId2 = 'b1000002-0002-4000-8000-000000000002';

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetRopewikiRegionLineage =
            require('../../../src/ropewiki/database/getRopewikiRegionLineage').default;
        mockGetRegionBannerUrls =
            require('../../../src/ropewiki/database/getRegionBannerUrls').default;
        mockGetRopewikiRegionLineage.mockResolvedValue([]);
        mockGetRegionBannerUrls.mockResolvedValue(new Map());
    });

    it('returns empty array when items is empty', async () => {
        const result = await enrichRopewikiPreviews(
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
        const items = [{ type: 'page' as const, id: pageId }];
        const pageRowsById = new Map<string, RopewikiPreviewPageRow>([
            [pageId, makePageRow({ pageId, regionId, regionName: 'Child Region', title: 'My Page' })],
        ]);
        mockGetRopewikiRegionLineage.mockResolvedValue([
            { id: regionId, name: 'Child Region' },
            { id: regionId2, name: 'Parent Region' },
        ]);

        const result = await enrichRopewikiPreviews(
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
        const items = [{ type: 'page' as const, id: pageId }];
        const pageRowsById = new Map<string, RopewikiPreviewPageRow>([
            [pageId, makePageRow({ pageId, regionId, regionName: 'Solo Region', title: 'Page' })],
        ]);
        mockGetRopewikiRegionLineage.mockResolvedValue([]);

        const result = await enrichRopewikiPreviews(
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
        const items = [{ type: 'region' as const, id: regionId }];
        const regionRowsById = new Map<string, RopewikiPreviewRegionRow>([
            [regionId, makeRegionRow({ id: regionId, name: 'Child', pageCount: 5 })],
        ]);
        mockGetRopewikiRegionLineage.mockResolvedValue([
            { id: regionId, name: 'Child' },
            { id: regionId2, name: 'Parent' },
        ]);
        mockGetRegionBannerUrls.mockResolvedValue(
            new Map([[regionId, 'https://example.com/banner.jpg']]),
        );

        const result = await enrichRopewikiPreviews(
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
        const items = [
            { type: 'page' as const, id: pageId },
            { type: 'page' as const, id: otherPageId },
            { type: 'region' as const, id: regionId },
        ];
        const pageRowsById = new Map<string, RopewikiPreviewPageRow>([
            [pageId, makePageRow({ pageId, regionId, title: 'First' })],
        ]);
        const regionRowsById = new Map<string, RopewikiPreviewRegionRow>([
            [regionId, makeRegionRow({ id: regionId })],
        ]);
        mockGetRopewikiRegionLineage.mockResolvedValue([]);

        const result = await enrichRopewikiPreviews(
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
        const items = [
            { type: 'region' as const, id: regionId },
            { type: 'page' as const, id: pageId },
        ];
        const pageRowsById = new Map<string, RopewikiPreviewPageRow>([
            [pageId, makePageRow({ pageId, regionId, title: 'Page' })],
        ]);
        const regionRowsById = new Map<string, RopewikiPreviewRegionRow>([
            [regionId, makeRegionRow({ id: regionId, name: 'Region' })],
        ]);
        mockGetRopewikiRegionLineage.mockResolvedValue([]);

        const result = await enrichRopewikiPreviews(
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
