import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { main } from '../../src/map-data/main';
import { PageDataSource } from 'ropegeo-common';
import { PageRoute, RopewikiRoute } from '../../src/types/pageRoute';
import MapData from '../../src/map-data/types/mapData';
import type { SaveMapDataHookFn } from '../../src/map-data/hook-functions/saveMapData';
import { MapDataEvent } from '../../src/map-data/types/lambdaEvent';
import ProgressLogger from '../../src/helpers/progressLogger';
import * as db from 'zapatos/db';

// Mock ProgressLogger
jest.mock('../../src/helpers/progressLogger', () => {
    return jest.fn().mockImplementation(() => ({
        setChunk: jest.fn(),
        logProgress: jest.fn(),
        logError: jest.fn(),
        getResults: jest.fn(),
    }));
});

// Mock database connection
const mockClient = {} as any;

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
        
        const upsertPageRouteModule = require('../../src/map-data/util/upsertPageRoute');
        mockUpsertPageRoute = upsertPageRouteModule.default;

        // Setup default mock implementations
        mockGetSourceFileUrl.mockResolvedValue(undefined);
        mockProcessMapData.mockResolvedValue(new MapData());
        mockUpsertMapData.mockResolvedValue(new MapData('', '', '', '', 'test-id'));
        mockUpsertPageRoute.mockResolvedValue(undefined);

        mockSaveMapDataHookFn = jest.fn<SaveMapDataHookFn>().mockResolvedValue(
            new MapData(
                undefined, // gpx
                'https://s3.amazonaws.com/bucket/source/file.kml', // kml
                'https://s3.amazonaws.com/bucket/geojson/file.geojson', // geoJson
                'https://s3.amazonaws.com/bucket/vector-tiles/file.mbtiles', // vectorTile
            ),
        );

        // Create mock logger
        mockLogger = new ProgressLogger('Test', 1);
    });

    it('creates new PageRoute from MapDataEvent', async () => {
        const mapDataEvent = createMapDataEvent();

        await main(mapDataEvent, mockSaveMapDataHookFn, mockLogger, mockClient);

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
        mockProcessMapData.mockResolvedValue(processedMapData);
        mockUpsertMapData.mockResolvedValue(upsertedMapData);

        await main(mapDataEvent, mockSaveMapDataHookFn, mockLogger, mockClient);

        expect(mockGetSourceFileUrl).toHaveBeenCalledWith(mockClient, pageDataSource, pageId);
        expect(mockProcessMapData).toHaveBeenCalledWith(
            sourceFileUrl,
            mockSaveMapDataHookFn,
            mapDataId,
            mockLogger,
            undefined,
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

        await main(mapDataEvent, mockSaveMapDataHookFn, mockLogger, mockClient);

        expect(mockProcessMapData).toHaveBeenCalledWith(
            sourceFileUrl,
            mockSaveMapDataHookFn,
            mapDataId,
            mockLogger,
            undefined,
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

        // When sourceFileUrl doesn't exist, upsertPageRoute should not be called
        expect(mockUpsertPageRoute).not.toHaveBeenCalled();
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
        mockUpsertMapData.mockResolvedValue(upsertedMapData);

        const controller = new AbortController();
        await main(mapDataEvent, mockSaveMapDataHookFn, mockLogger, mockClient, controller.signal);

        expect(mockProcessMapData).toHaveBeenCalledWith(
            sourceFileUrl,
            mockSaveMapDataHookFn,
            undefined,
            mockLogger,
            controller.signal,
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
            return new MapData(
                undefined,
                'https://s3.amazonaws.com/bucket/source/file.kml',
                'https://s3.amazonaws.com/bucket/geojson/file.geojson',
                'https://s3.amazonaws.com/bucket/vector-tiles/file.mbtiles',
            );
        });
        mockUpsertMapData.mockResolvedValue(upsertedMapData);

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
        mockUpsertMapData.mockResolvedValue(upsertedMapData);

        await main(mapDataEvent, mockSaveMapDataHookFn, mockLogger, mockClient);

        expect(mockProcessMapData).toHaveBeenCalledWith(
            sourceFileUrl,
            mockSaveMapDataHookFn,
            undefined,
            mockLogger,
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
