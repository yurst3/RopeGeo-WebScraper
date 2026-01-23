import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { main } from '../../src/map-data/main';
import { PageDataSource } from '../../src/types/pageRoute';
import { PageRoute, RopewikiRoute } from '../../src/types/pageRoute';
import MapData from '../../src/map-data/types/mapData';
import type { SaveMapDataHookFn } from '../../src/map-data/hook-functions/saveMapData';
import { MapDataEvent } from '../../src/map-data/types/lambdaEvent';
import * as db from 'zapatos/db';

// Mock database connection
const mockClient = {
    release: jest.fn(),
} as any;

const mockPool = {
    connect: jest.fn(() => Promise.resolve(mockClient)),
    end: jest.fn(() => Promise.resolve()),
} as any;

jest.mock('../../src/helpers/getDatabaseConnection', () => ({
    __esModule: true,
    default: jest.fn(() => Promise.resolve(mockPool)),
}));

// Mock utility functions
let mockGetSourceFileUrl: jest.MockedFunction<typeof import('../../src/map-data/util/getSourceFileUrl').default>;
let mockProcessMapData: jest.MockedFunction<typeof import('../../src/map-data/processors/processMapData').processMapData>;
let mockUpsertMapData: jest.MockedFunction<typeof import('../../src/map-data/database/upsertMapData').default>;
let mockUpsertPageRoute: jest.MockedFunction<typeof import('../../src/map-data/util/upsertPageRoute').default>;

jest.mock('../../src/map-data/util/getSourceFileUrl', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../src/map-data/processors/processMapData', () => ({
    processMapData: jest.fn(),
}));

jest.mock('../../src/map-data/database/upsertMapData', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../src/map-data/util/upsertPageRoute', () => ({
    __esModule: true,
    default: jest.fn(),
}));

describe('main', () => {
    let mockSaveMapDataHookFn: jest.MockedFunction<SaveMapDataHookFn>;
    const pageDataSource = PageDataSource.Ropewiki;
    const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';
    const routeId = '11111111-1111-1111-1111-111111111111';
    
    const createMapDataEvent = (mapDataId?: string): MapDataEvent => {
        return new MapDataEvent(pageDataSource, routeId, pageId, mapDataId);
    };

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup mocks
        const getSourceFileUrlModule = require('../../src/map-data/util/getSourceFileUrl');
        mockGetSourceFileUrl = getSourceFileUrlModule.default;
        
        const processMapDataModule = require('../../src/map-data/processors/processMapData');
        mockProcessMapData = processMapDataModule.processMapData;
        
        const upsertMapDataModule = require('../../src/map-data/database/upsertMapData');
        mockUpsertMapData = upsertMapDataModule.default;
        
        const upsertPageRouteModule = require('../../src/map-data/util/upsertPageRoute');
        mockUpsertPageRoute = upsertPageRouteModule.default;

        // Setup default mock implementations
        mockGetSourceFileUrl.mockResolvedValue(undefined);
        mockProcessMapData.mockResolvedValue(new MapData());
        mockUpsertMapData.mockResolvedValue(new MapData('', '', '', '', 'test-id'));
        mockUpsertPageRoute.mockResolvedValue(undefined);

        mockSaveMapDataHookFn = jest.fn<SaveMapDataHookFn>().mockResolvedValue({
            sourceFile: 'https://s3.amazonaws.com/bucket/source/file.kml',
            geoJsonFile: 'https://s3.amazonaws.com/bucket/geojson/file.geojson',
            vectorTileFile: 'https://s3.amazonaws.com/bucket/vector-tiles/file.mbtiles',
        });
    });

    it('creates new PageRoute from MapDataEvent', async () => {
        const mapDataEvent = createMapDataEvent();

        await main(mockSaveMapDataHookFn, mapDataEvent);

        // When sourceFileUrl doesn't exist, upsertPageRoute should not be called
        expect(mockUpsertPageRoute).not.toHaveBeenCalled();
    });

    it('uses mapDataId from MapDataEvent when provided', async () => {
        const mapDataId = 'existing-map-data-id';
        const mapDataEvent = createMapDataEvent(mapDataId);
        const sourceFileUrl = 'https://example.com/file.kml';
        const upsertedMapData = new MapData(
            undefined,
            'https://s3.amazonaws.com/bucket/source/file.kml',
            'https://s3.amazonaws.com/bucket/geojson/file.geojson',
            'https://s3.amazonaws.com/bucket/vector-tiles/file.mbtiles',
            'new-map-data-id',
        );

        mockGetSourceFileUrl.mockResolvedValue(sourceFileUrl);
        mockUpsertMapData.mockResolvedValue(upsertedMapData);

        await main(mockSaveMapDataHookFn, mapDataEvent);

        // When sourceFileUrl exists, upsertPageRoute should be called with updated mapData
        expect(mockUpsertPageRoute).toHaveBeenCalledWith(
            mockClient,
            pageDataSource,
            expect.objectContaining({
                route: routeId,
                page: pageId,
                mapData: 'new-map-data-id',
            }),
        );
    });

    it('processes map data when source file URL exists', async () => {
        const sourceFileUrl = 'https://example.com/file.kml';
        const mapDataId = '22222222-2222-2222-2222-222222222222';
        const mapDataEvent = createMapDataEvent(mapDataId);
        const processedMapData = new MapData(
            undefined,
            'https://s3.amazonaws.com/bucket/source/file.kml',
            'https://s3.amazonaws.com/bucket/geojson/file.geojson',
            'https://s3.amazonaws.com/bucket/vector-tiles/file.mbtiles',
        );
        const upsertedMapData = new MapData(
            undefined,
            'https://s3.amazonaws.com/bucket/source/file.kml',
            'https://s3.amazonaws.com/bucket/geojson/file.geojson',
            'https://s3.amazonaws.com/bucket/vector-tiles/file.mbtiles',
            'new-map-data-id',
        );

        mockGetSourceFileUrl.mockResolvedValue(sourceFileUrl);
        mockProcessMapData.mockResolvedValue(processedMapData);
        mockUpsertMapData.mockResolvedValue(upsertedMapData);

        await main(mockSaveMapDataHookFn, mapDataEvent);

        expect(mockGetSourceFileUrl).toHaveBeenCalledWith(mockClient, pageDataSource, pageId);
        expect(mockProcessMapData).toHaveBeenCalledWith(
            sourceFileUrl,
            mockSaveMapDataHookFn,
            mapDataId,
        );
        expect(mockUpsertMapData).toHaveBeenCalledWith(mockClient, processedMapData);
        expect(mockUpsertPageRoute).toHaveBeenCalledWith(
            mockClient,
            pageDataSource,
            expect.objectContaining({
                route: routeId,
                page: pageId,
                mapData: 'new-map-data-id',
            }),
        );
    });

    it('skips map data processing when source file URL does not exist', async () => {
        const mapDataEvent = createMapDataEvent();
        mockGetSourceFileUrl.mockResolvedValue(undefined);

        await main(mockSaveMapDataHookFn, mapDataEvent);

        expect(mockGetSourceFileUrl).toHaveBeenCalledWith(mockClient, pageDataSource, pageId);
        expect(mockProcessMapData).not.toHaveBeenCalled();
        expect(mockUpsertMapData).not.toHaveBeenCalled();
        // When sourceFileUrl doesn't exist, upsertPageRoute should not be called
        expect(mockUpsertPageRoute).not.toHaveBeenCalled();
    });

    it('uses existing mapDataId when processing new source file', async () => {
        const sourceFileUrl = 'https://example.com/file.kml';
        const mapDataId = '33333333-3333-3333-3333-333333333333';
        const mapDataEvent = createMapDataEvent(mapDataId);

        mockGetSourceFileUrl.mockResolvedValue(sourceFileUrl);

        await main(mockSaveMapDataHookFn, mapDataEvent);

        expect(mockProcessMapData).toHaveBeenCalledWith(
            sourceFileUrl,
            mockSaveMapDataHookFn,
            mapDataId,
        );
    });

    it('generates new mapDataId when processing without existing mapDataId', async () => {
        const sourceFileUrl = 'https://example.com/file.kml';
        const mapDataEvent = createMapDataEvent(); // No mapDataId

        mockGetSourceFileUrl.mockResolvedValue(sourceFileUrl);

        await main(mockSaveMapDataHookFn, mapDataEvent);

        expect(mockProcessMapData).toHaveBeenCalledWith(
            sourceFileUrl,
            mockSaveMapDataHookFn,
            undefined,
        );
    });

    it('updates PageRoute with new mapDataId after processing', async () => {
        const sourceFileUrl = 'https://example.com/file.kml';
        const mapDataEvent = createMapDataEvent();
        const upsertedMapData = new MapData(
            undefined,
            'https://s3.amazonaws.com/bucket/source/file.kml',
            'https://s3.amazonaws.com/bucket/geojson/file.geojson',
            'https://s3.amazonaws.com/bucket/vector-tiles/file.mbtiles',
            'new-map-data-id',
        );

        mockGetSourceFileUrl.mockResolvedValue(sourceFileUrl);
        mockUpsertMapData.mockResolvedValue(upsertedMapData);

        await main(mockSaveMapDataHookFn, mapDataEvent);

        expect(mockUpsertPageRoute).toHaveBeenCalledWith(
            mockClient,
            pageDataSource,
            expect.objectContaining({
                route: routeId,
                page: pageId,
                mapData: 'new-map-data-id',
            }),
        );
    });

    it('does not upsert PageRoute when source file URL does not exist', async () => {
        const mapDataEvent = createMapDataEvent();
        mockGetSourceFileUrl.mockResolvedValue(undefined);

        await main(mockSaveMapDataHookFn, mapDataEvent);

        // When sourceFileUrl doesn't exist, upsertPageRoute should not be called
        expect(mockUpsertPageRoute).not.toHaveBeenCalled();
    });

    it('releases database client after processing', async () => {
        const mapDataEvent = createMapDataEvent();
        await main(mockSaveMapDataHookFn, mapDataEvent);

        expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('closes database pool after processing', async () => {
        const mapDataEvent = createMapDataEvent();
        await main(mockSaveMapDataHookFn, mapDataEvent);

        expect(mockPool.end).toHaveBeenCalledTimes(1);
    });

    it('releases client and closes pool even when an error occurs', async () => {
        const mapDataEvent = createMapDataEvent();
        const error = new Error('Processing failed');
        mockGetSourceFileUrl.mockRejectedValue(error);

        await expect(
            main(mockSaveMapDataHookFn, mapDataEvent),
        ).rejects.toThrow('Processing failed');

        expect(mockClient.release).toHaveBeenCalledTimes(1);
        expect(mockPool.end).toHaveBeenCalledTimes(1);
    });

    it('propagates errors from getSourceFileUrl', async () => {
        const mapDataEvent = createMapDataEvent();
        const error = new Error('Failed to get source file URL');
        mockGetSourceFileUrl.mockRejectedValue(error);

        await expect(
            main(mockSaveMapDataHookFn, mapDataEvent),
        ).rejects.toThrow('Failed to get source file URL');
    });

    it('propagates errors from processMapData', async () => {
        const mapDataEvent = createMapDataEvent();
        const sourceFileUrl = 'https://example.com/file.kml';
        const error = new Error('Failed to process map data');
        
        mockGetSourceFileUrl.mockResolvedValue(sourceFileUrl);
        mockProcessMapData.mockRejectedValue(error);

        await expect(
            main(mockSaveMapDataHookFn, mapDataEvent),
        ).rejects.toThrow('Failed to process map data');
    });

    it('propagates errors from upsertMapData', async () => {
        const mapDataEvent = createMapDataEvent();
        const sourceFileUrl = 'https://example.com/file.kml';
        const error = new Error('Failed to upsert map data');
        
        mockGetSourceFileUrl.mockResolvedValue(sourceFileUrl);
        mockUpsertMapData.mockRejectedValue(error);

        await expect(
            main(mockSaveMapDataHookFn, mapDataEvent),
        ).rejects.toThrow('Failed to upsert map data');
    });

    it('propagates errors from upsertPageRoute', async () => {
        const mapDataEvent = createMapDataEvent();
        const sourceFileUrl = 'https://example.com/file.kml';
        const error = new Error('Failed to upsert page route');
        
        mockGetSourceFileUrl.mockResolvedValue(sourceFileUrl);
        mockUpsertPageRoute.mockRejectedValue(error);

        await expect(
            main(mockSaveMapDataHookFn, mapDataEvent),
        ).rejects.toThrow('Failed to upsert page route');
    });

    it('handles case where MapDataEvent has no mapDataId', async () => {
        const mapDataEvent = createMapDataEvent(); // No mapDataId
        const sourceFileUrl = 'https://example.com/file.kml';
        const upsertedMapData = new MapData(
            undefined,
            'https://s3.amazonaws.com/bucket/source/file.kml',
            'https://s3.amazonaws.com/bucket/geojson/file.geojson',
            'https://s3.amazonaws.com/bucket/vector-tiles/file.mbtiles',
            'new-map-data-id',
        );

        mockGetSourceFileUrl.mockResolvedValue(sourceFileUrl);
        mockUpsertMapData.mockResolvedValue(upsertedMapData);

        await main(mockSaveMapDataHookFn, mapDataEvent);

        expect(mockProcessMapData).toHaveBeenCalledWith(
            sourceFileUrl,
            mockSaveMapDataHookFn,
            undefined,
        );
        expect(mockUpsertPageRoute).toHaveBeenCalledWith(
            mockClient,
            pageDataSource,
            expect.objectContaining({
                mapData: 'new-map-data-id',
            }),
        );
    });
});
