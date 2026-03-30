import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { PoolClient } from 'pg';
import { handler } from '../../../src/api/getRopewikiPageLinkPreview/handler';
import type { RopewikiPageView } from 'ropegeo-common';
import { Difficulty, PermitStatus } from 'ropegeo-common';

let mockGetDatabaseConnection: jest.MockedFunction<typeof import('../../../src/helpers/getDatabaseConnection').default>;
let mockGetRopewikiPageView: jest.MockedFunction<
    typeof import('../../../src/api/getRopewikiPageView/database/getRopewikiPageView').default
>;
let mockGetBannerImageMetadataForPage: jest.MockedFunction<
    typeof import('../../../src/api/getRopewikiPageLinkPreview/database/getBannerImageMetadataForPage').default
>;

let mockClient: PoolClient;
let mockPool: { connect: ReturnType<typeof jest.fn> };

jest.mock('../../../src/helpers/getDatabaseConnection', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../src/api/getRopewikiPageView/database/getRopewikiPageView', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../src/api/getRopewikiPageLinkPreview/database/getBannerImageMetadataForPage', () => ({
    __esModule: true,
    default: jest.fn(),
}));

let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

function minimalView(overrides: Partial<RopewikiPageView> = {}): RopewikiPageView {
    const difficulty = new Difficulty('3', 'A', 'II', 'PG13');
    return {
        name: 'Test Canyon',
        aka: ['Alt One', 'Alt Two'],
        url: 'https://ropewiki.com/Test',
        quality: 4,
        userVotes: 1,
        difficulty,
        permit: PermitStatus.No,
        rappelCount: 5,
        jumps: null,
        vehicle: null,
        rappelLongest: 135,
        shuttleTime: null,
        overallLength: null,
        descentLength: null,
        exitLength: null,
        approachLength: null,
        overallTime: null,
        approachTime: null,
        descentTime: null,
        exitTime: null,
        approachElevGain: null,
        descentElevGain: null,
        exitElevGain: null,
        months: [],
        latestRevisionDate: new Date('2025-01-01T00:00:00.000Z'),
        regions: [],
        bannerImage: null,
        betaSections: [],
        miniMap: null,
        ...overrides,
    } as RopewikiPageView;
}

describe('getRopewikiPageLinkPreview handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        mockClient = { release: jest.fn() } as unknown as PoolClient;
        mockPool = {
            connect: jest.fn().mockResolvedValue(mockClient as never),
        };

        mockGetDatabaseConnection = require('../../../src/helpers/getDatabaseConnection').default;
        mockGetRopewikiPageView = require('../../../src/api/getRopewikiPageView/database/getRopewikiPageView').default;
        mockGetBannerImageMetadataForPage = require('../../../src/api/getRopewikiPageLinkPreview/database/getBannerImageMetadataForPage')
            .default;

        mockGetDatabaseConnection.mockResolvedValue(mockPool as never);
        mockGetRopewikiPageView.mockResolvedValue(null);
        mockGetBannerImageMetadataForPage.mockResolvedValue(null);
    });

    it('returns 400 when id is missing', async () => {
        const result = await handler({ pathParameters: {} }, {});
        expect(mockGetDatabaseConnection).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(400);
    });

    it('returns 404 when page not found', async () => {
        const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        const result = await handler({ pathParameters: { id } }, {});
        expect(result.statusCode).toBe(404);
        expect(mockGetBannerImageMetadataForPage).not.toHaveBeenCalled();
    });

    it('returns 200 with ropewikiPageLinkPreview and LinkPreview fields', async () => {
        const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        mockGetRopewikiPageView.mockResolvedValue(minimalView());

        const result = await handler({ pathParameters: { id } }, {});

        expect(mockGetBannerImageMetadataForPage).toHaveBeenCalledWith(mockClient, id);
        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.resultType).toBe('ropewikiPageLinkPreview');
        expect(body.result.title).toBe('Test Canyon AKA Alt One, Alt Two');
        expect(body.result.description).toContain('3A II PG13');
        expect(body.result.description).toContain('5 rappels');
        expect(body.result.description).toContain('135ft max');
        expect(body.result.siteName).toBe('RopeGeo');
        expect(body.result.type).toBe('website');
        expect(body.result.image).toBeNull();
    });

    it('returns image when bannerUrl present and metadata has dimensions', async () => {
        const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        mockGetRopewikiPageView.mockResolvedValue(
            minimalView({
                aka: [],
                bannerImage: {
                    order: 0,
                    id: '550e8400-e29b-41d4-a716-446655440000',
                    bannerUrl: 'https://cdn.example.com/b.avif',
                    fullUrl: null,
                    linkUrl: 'https://ropewiki.com/File:X',
                    caption: null,
                    latestRevisionDate: new Date('2025-01-01T00:00:00.000Z'),
                    downloadBytes: null,
                } as RopewikiPageView['bannerImage'],
            }),
        );
        mockGetBannerImageMetadataForPage.mockResolvedValue({
            metadata: {
                banner: {
                    sizeKB: 10,
                    dimensions: { width: 800, height: 400 },
                    orientation: 1,
                    mimeType: 'image/avif',
                },
            },
            linkPreviewUrl: null,
        });

        const result = await handler({ pathParameters: { id } }, {});
        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.result.image).toEqual({
            url: 'https://cdn.example.com/b.avif',
            height: '400',
            width: '800',
            type: 'image/avif',
            alt: 'Test Canyon',
        });
    });

    it('handles getDatabaseConnection failure', async () => {
        mockGetDatabaseConnection.mockRejectedValue(new Error('db down'));
        const result = await handler(
            { pathParameters: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' } },
            {},
        );
        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(result.statusCode).toBe(500);
    });
});
