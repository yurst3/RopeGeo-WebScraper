import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { main } from '../../src/map-data/main';
import { Bounds, LineLegendItem, PageDataSource } from 'ropegeo-common/models';
import { PageRoute, RopewikiRoute } from '../../src/types/pageRoute';
import MapData from '../../src/map-data/types/mapData';
import type { SaveMapDataHookFn } from '../../src/map-data/hook-functions/saveMapData';
import { MapDataEvent } from '../../src/map-data/types/mapDataEvent';
import { ProgressLogger } from 'ropegeo-common/helpers';
import type { ProcessMapDataResult } from '../../src/map-data/types/processMapDataResult';
import type { UpsertMapDataResult } from '../../src/map-data/types/upsertMapDataResult';
import * as db from 'zapatos/db';

function processResult(mapData: MapData, legend?: ProcessMapDataResult['legend']): ProcessMapDataResult {
    return { mapData, legend };
}

function upsertResult(mapData: MapData, applied = true): UpsertMapDataResult {
    return { mapData, applied };
}

jest.mock('ropegeo-common/helpers', () => ({
    __esModule: true,
    ProgressLogger: jest.fn().mockImplementation(() => ({
        setChunk: jest.fn(),
        logProgress: jest.fn(),
        logError: jest.fn(),
        getResults: jest.fn(),
    })),
}));

// Mock database connection
const mockClient = {} as any;

// Mock utility functions
let mockGetSourceFileUrl: jest.MockedFunction<typeof import('../../src/map-data/util/getSourceFileUrl').default>;
let mockProcessMapData: jest.MockedFunction<typeof import('../../src/map-data/processors/processMapData').processMapData>;
let mockUpsertMapData: jest.MockedFunction<typeof import('../../src/map-data/database/upsertMapData').default>;
let mockReplaceMapDataLegendItems: jest.MockedFunction<typeof import('../../src/map-data/database/replaceMapDataLegendItems').default>;
let mockUpsertPageRoute: jest.MockedFunction<typeof import('../../src/map-data/util/upsertPageRoute').default>;
let mockUpsertRelevanceContextJob: jest.MockedFunction<typeof import('../../src/map-data/database/upsertRelevanceContextJob').upsertRelevanceContextJob>;

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

jest.mock('../../src/map-data/database/replaceMapDataLegendItems', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../src/map-data/util/upsertPageRoute', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../src/map-data/database/upsertRelevanceContextJob', () => ({
    __esModule: true,
    upsertRelevanceContextJob: jest.fn(),
}));

describe('main', () => {
    let mockSaveMapDataHookFn: jest.MockedFunction<SaveMapDataHookFn>;
    let mockLogger: any;
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

        const replaceMapDataLegendItemsModule = require('../../src/map-data/database/replaceMapDataLegendItems');
        mockReplaceMapDataLegendItems = replaceMapDataLegendItemsModule.default;
        
        const upsertPageRouteModule = require('../../src/map-data/util/upsertPageRoute');
        mockUpsertPageRoute = upsertPageRouteModule.default;

        const upsertRelevanceContextJobModule = require('../../src/map-data/database/upsertRelevanceContextJob');
        mockUpsertRelevanceContextJob = upsertRelevanceContextJobModule.upsertRelevanceContextJob;

        // Setup default mock implementations
        mockGetSourceFileUrl.mockResolvedValue(undefined);
        mockProcessMapData.mockResolvedValue(processResult(new MapData()));
        mockUpsertMapData.mockResolvedValue(upsertResult(new MapData('', '', '', '', 'test-id')));
        mockReplaceMapDataLegendItems.mockResolvedValue(undefined);
        mockUpsertPageRoute.mockResolvedValue(undefined);
        mockUpsertRelevanceContextJob.mockResolvedValue(undefined);

        mockSaveMapDataHookFn = jest.fn<SaveMapDataHookFn>().mockResolvedValue(
            new MapData(
                undefined, // gpx
                'https://s3.amazonaws.com/bucket/source/file.kml', // kml
                'https://s3.amazonaws.com/bucket/geojson/file.geojson', // geoJson
                'https://api.example.com/mapdata/tiles/file-id/', // tiles
            ),
        );

        // Create mock logger
        mockLogger = new ProgressLogger('Test', 1);
    });

    it('creates new PageRoute from MapDataEvent', async () => {
        const mapDataEvent = createMapDataEvent();

        await main(mapDataEvent, mockSaveMapDataHookFn, mockLogger, mockClient);

        expect(mockLogger.logError).toHaveBeenCalledWith(
            `No source file URL for route ${routeId} / page ${pageId}`,
        );
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
        mockUpsertMapData.mockResolvedValue(upsertResult(upsertedMapData));

        await main(mapDataEvent, mockSaveMapDataHookFn, mockLogger, mockClient);

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
        mockProcessMapData.mockResolvedValue(processResult(processedMapData));
        mockUpsertMapData.mockResolvedValue(upsertResult(upsertedMapData));

        await main(mapDataEvent, mockSaveMapDataHookFn, mockLogger, mockClient);

        expect(mockGetSourceFileUrl).toHaveBeenCalledWith(mockClient, pageDataSource, pageId);
        expect(mockProcessMapData).toHaveBeenCalledWith(
            sourceFileUrl,
            mockSaveMapDataHookFn,
            mapDataId,
            mockLogger,
            undefined,
            true,
            false,
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

        await main(mapDataEvent, mockSaveMapDataHookFn, mockLogger, mockClient);

        expect(mockGetSourceFileUrl).toHaveBeenCalledWith(mockClient, pageDataSource, pageId);
        expect(mockLogger.logError).toHaveBeenCalledWith(
            `No source file URL for route ${routeId} / page ${pageId}`,
        );
        expect(mockProcessMapData).not.toHaveBeenCalled();
        expect(mockUpsertMapData).not.toHaveBeenCalled();
        expect(mockReplaceMapDataLegendItems).not.toHaveBeenCalled();
        expect(mockUpsertPageRoute).not.toHaveBeenCalled();
    });

    it('uses existing mapDataId when processing new source file', async () => {
        const sourceFileUrl = 'https://example.com/file.kml';
        const mapDataId = '33333333-3333-3333-3333-333333333333';
        const mapDataEvent = createMapDataEvent(mapDataId);

        mockGetSourceFileUrl.mockResolvedValue(sourceFileUrl);

        await main(mapDataEvent, mockSaveMapDataHookFn, mockLogger, mockClient);

        expect(mockProcessMapData).toHaveBeenCalledWith(
            sourceFileUrl,
            mockSaveMapDataHookFn,
            mapDataId,
            mockLogger,
            undefined,
            true,
            false,
        );
    });

    it('generates new mapDataId when processing without existing mapDataId', async () => {
        const sourceFileUrl = 'https://example.com/file.kml';
        const mapDataEvent = createMapDataEvent(); // No mapDataId

        mockGetSourceFileUrl.mockResolvedValue(sourceFileUrl);

        await main(mapDataEvent, mockSaveMapDataHookFn, mockLogger, mockClient);

        expect(mockProcessMapData).toHaveBeenCalledWith(
            sourceFileUrl,
            mockSaveMapDataHookFn,
            undefined,
            mockLogger,
            undefined,
            true,
            false,
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
        mockUpsertMapData.mockResolvedValue(upsertResult(upsertedMapData));

        await main(mapDataEvent, mockSaveMapDataHookFn, mockLogger, mockClient);

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

        await main(mapDataEvent, mockSaveMapDataHookFn, mockLogger, mockClient);

        expect(mockLogger.logError).toHaveBeenCalledWith(
            `No source file URL for route ${routeId} / page ${pageId}`,
        );
        expect(mockUpsertPageRoute).not.toHaveBeenCalled();
        expect(mockReplaceMapDataLegendItems).not.toHaveBeenCalled();
    });

    it('calls replaceMapDataLegendItems when upsert applies and legend is present', async () => {
        const sourceFileUrl = 'https://example.com/file.kml';
        const mapDataEvent = createMapDataEvent();
        const bounds = new Bounds(40, 39, -110, -111);
        const legend = { s1: new LineLegendItem('s1', 'Segment', bounds) };
        const processedMapData = new MapData(undefined, undefined, undefined, undefined, 'map-id');
        const upsertedMapData = new MapData(undefined, undefined, undefined, undefined, 'map-id');

        mockGetSourceFileUrl.mockResolvedValue(sourceFileUrl);
        mockProcessMapData.mockResolvedValue(processResult(processedMapData, legend));
        mockUpsertMapData.mockResolvedValue(upsertResult(upsertedMapData, true));

        await main(mapDataEvent, mockSaveMapDataHookFn, mockLogger, mockClient);

        expect(mockReplaceMapDataLegendItems).toHaveBeenCalledWith(mockClient, 'map-id', legend);
        expect(mockUpsertRelevanceContextJob).toHaveBeenCalledWith(mockClient, {
            mapDataId: 'map-id',
            pageId,
            pageSource: pageDataSource,
        });
    });

    it('skips upsertRelevanceContextJob when processRelevantContext is false', async () => {
        const sourceFileUrl = 'https://example.com/file.kml';
        const mapDataEvent = new MapDataEvent(
            pageDataSource,
            routeId,
            pageId,
            undefined,
            true,
            false,
            false,
        );
        const bounds = new Bounds(40, 39, -110, -111);
        const legend = { s1: new LineLegendItem('s1', 'Segment', bounds) };
        const processedMapData = new MapData(undefined, undefined, undefined, undefined, 'map-id');
        const upsertedMapData = new MapData(undefined, undefined, undefined, undefined, 'map-id');

        mockGetSourceFileUrl.mockResolvedValue(sourceFileUrl);
        mockProcessMapData.mockResolvedValue(processResult(processedMapData, legend));
        mockUpsertMapData.mockResolvedValue(upsertResult(upsertedMapData, true));

        await main(mapDataEvent, mockSaveMapDataHookFn, mockLogger, mockClient);

        expect(mockReplaceMapDataLegendItems).toHaveBeenCalledWith(mockClient, 'map-id', legend);
        expect(mockUpsertRelevanceContextJob).not.toHaveBeenCalled();
        expect(mockUpsertPageRoute).toHaveBeenCalled();
    });

    it('does not call replaceMapDataLegendItems when upsert was skipped', async () => {
        const sourceFileUrl = 'https://example.com/file.kml';
        const mapDataEvent = createMapDataEvent();
        const bounds = new Bounds(40, 39, -110, -111);
        const legend = { s1: new LineLegendItem('s1', 'Segment', bounds) };
        const processedMapData = new MapData(undefined, undefined, undefined, undefined, 'map-id');
        const existingMapData = new MapData('https://example.com/old.gpx', undefined, undefined, undefined, 'map-id');

        mockGetSourceFileUrl.mockResolvedValue(sourceFileUrl);
        mockProcessMapData.mockResolvedValue(processResult(processedMapData, legend));
        mockUpsertMapData.mockResolvedValue(upsertResult(existingMapData, false));

        await main(mapDataEvent, mockSaveMapDataHookFn, mockLogger, mockClient);

        expect(mockReplaceMapDataLegendItems).not.toHaveBeenCalled();
        expect(mockUpsertRelevanceContextJob).not.toHaveBeenCalled();
    });

    it('propagates errors from replaceMapDataLegendItems', async () => {
        const sourceFileUrl = 'https://example.com/file.kml';
        const mapDataEvent = createMapDataEvent();
        const error = new Error('Failed to replace legend items');

        mockGetSourceFileUrl.mockResolvedValue(sourceFileUrl);
        mockUpsertMapData.mockResolvedValue(upsertResult(new MapData(undefined, undefined, undefined, undefined, 'map-id')));
        mockReplaceMapDataLegendItems.mockRejectedValue(error);

        await expect(
            main(mapDataEvent, mockSaveMapDataHookFn, mockLogger, mockClient),
        ).rejects.toThrow('Failed to replace legend items');
    });

    it('propagates errors from getSourceFileUrl', async () => {
        const mapDataEvent = createMapDataEvent();
        const error = new Error('Failed to get source file URL');
        mockGetSourceFileUrl.mockRejectedValue(error);

        await expect(
            main(mapDataEvent, mockSaveMapDataHookFn, mockLogger, mockClient),
        ).rejects.toThrow('Failed to get source file URL');
    });

    it('propagates errors from processMapData', async () => {
        const mapDataEvent = createMapDataEvent();
        const sourceFileUrl = 'https://example.com/file.kml';
        const error = new Error('Failed to process map data');
        
        mockGetSourceFileUrl.mockResolvedValue(sourceFileUrl);
        mockProcessMapData.mockRejectedValue(error);

        await expect(
            main(mapDataEvent, mockSaveMapDataHookFn, mockLogger, mockClient),
        ).rejects.toThrow('Failed to process map data');
    });

    it('propagates errors from upsertMapData', async () => {
        const mapDataEvent = createMapDataEvent();
        const sourceFileUrl = 'https://example.com/file.kml';
        const error = new Error('Failed to upsert map data');
        
        mockGetSourceFileUrl.mockResolvedValue(sourceFileUrl);
        mockUpsertMapData.mockRejectedValue(error);

        await expect(
            main(mapDataEvent, mockSaveMapDataHookFn, mockLogger, mockClient),
        ).rejects.toThrow('Failed to upsert map data');
    });

    it('propagates errors from upsertPageRoute', async () => {
        const mapDataEvent = createMapDataEvent();
        const sourceFileUrl = 'https://example.com/file.kml';
        const error = new Error('Failed to upsert page route');
        
        mockGetSourceFileUrl.mockResolvedValue(sourceFileUrl);
        mockUpsertPageRoute.mockRejectedValue(error);

        await expect(
            main(mapDataEvent, mockSaveMapDataHookFn, mockLogger, mockClient),
        ).rejects.toThrow('Failed to upsert page route');
    });

    it('calls processMapData with abortSignal when provided and not aborted', async () => {
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
        mockUpsertMapData.mockResolvedValue(upsertResult(upsertedMapData));

        const controller = new AbortController();
        await main(mapDataEvent, mockSaveMapDataHookFn, mockLogger, mockClient, controller.signal);

        expect(mockProcessMapData).toHaveBeenCalledWith(
            sourceFileUrl,
            mockSaveMapDataHookFn,
            undefined,
            mockLogger,
            controller.signal,
            true,
            false,
        );
        expect(mockUpsertMapData).toHaveBeenCalled();
        expect(mockUpsertPageRoute).toHaveBeenCalled();
    });

    it('calls upsertMapData and upsertPageRoute when abortSignal is aborted after processMapData returns', async () => {
        const sourceFileUrl = 'https://example.com/file.kml';
        const mapDataEvent = createMapDataEvent();
        const controller = new AbortController();
        const upsertedMapData = new MapData(
            undefined,
            'https://s3.amazonaws.com/bucket/source/file.kml',
            'https://s3.amazonaws.com/bucket/geojson/file.geojson',
            'https://s3.amazonaws.com/bucket/vector-tiles/file.mbtiles',
            'new-map-data-id',
        );
        mockGetSourceFileUrl.mockResolvedValue(sourceFileUrl);
        mockProcessMapData.mockImplementation(async () => {
            controller.abort(new Error('Timed out'));
            return processResult(new MapData(
                undefined,
                'https://s3.amazonaws.com/bucket/source/file.kml',
                'https://s3.amazonaws.com/bucket/geojson/file.geojson',
                'https://s3.amazonaws.com/bucket/vector-tiles/file.mbtiles',
            ));
        });
        mockUpsertMapData.mockResolvedValue(upsertResult(upsertedMapData));

        await main(mapDataEvent, mockSaveMapDataHookFn, mockLogger, mockClient, controller.signal);

        expect(mockUpsertMapData).toHaveBeenCalled();
        expect(mockUpsertPageRoute).toHaveBeenCalled();
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
        mockUpsertMapData.mockResolvedValue(upsertResult(upsertedMapData));

        await main(mapDataEvent, mockSaveMapDataHookFn, mockLogger, mockClient);

        expect(mockProcessMapData).toHaveBeenCalledWith(
            sourceFileUrl,
            mockSaveMapDataHookFn,
            undefined,
            mockLogger,
            undefined,
            true,
            false,
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
