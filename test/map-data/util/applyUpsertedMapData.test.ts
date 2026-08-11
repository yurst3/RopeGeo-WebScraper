import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import applyUpsertedMapData from '../../../src/map-data/util/applyUpsertedMapData';
import replaceMapDataLegendItems from '../../../src/map-data/database/replaceMapDataLegendItems';
import { upsertRelevanceContextJob } from '../../../src/map-data/database/upsertRelevanceContextJob';
import { upsertPageZipperMapDataLegendItemsReady } from '../../../src/map-data/util/upsertPageZipperMapDataLegendItemsReady';
import { MapDataEvent } from '../../../src/map-data/types/mapDataEvent';
import { Bounds, LineLegendItem, PageDataSource } from 'ropegeo-common/models';

jest.mock('../../../src/map-data/database/replaceMapDataLegendItems', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../src/map-data/database/upsertRelevanceContextJob', () => ({
    upsertRelevanceContextJob: jest.fn(),
}));
jest.mock('../../../src/map-data/util/upsertPageZipperMapDataLegendItemsReady', () => ({
    upsertPageZipperMapDataLegendItemsReady: jest.fn(),
}));

describe('applyUpsertedMapData', () => {
    const conn = {} as never;
    const legend = {
        s1: new LineLegendItem('s1', 'Segment', new Bounds(40, 39, -110, -111)),
    };
    const event = new MapDataEvent(
        PageDataSource.Ropewiki,
        'route-1',
        'page-1',
        'map-1',
    );

    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(replaceMapDataLegendItems).mockResolvedValue(undefined);
        jest.mocked(upsertRelevanceContextJob).mockResolvedValue({} as never);
        jest.mocked(upsertPageZipperMapDataLegendItemsReady).mockResolvedValue({} as never);
    });

    it('no-ops when upsert was not applied', async () => {
        await applyUpsertedMapData(conn, false, 'map-1', legend, event);
        expect(replaceMapDataLegendItems).not.toHaveBeenCalled();
        expect(upsertRelevanceContextJob).not.toHaveBeenCalled();
        expect(upsertPageZipperMapDataLegendItemsReady).not.toHaveBeenCalled();
    });

    it('no-ops when mapDataId is missing', async () => {
        await applyUpsertedMapData(conn, true, undefined, legend, event);
        expect(replaceMapDataLegendItems).not.toHaveBeenCalled();
    });

    it('replaces legend, seeds zipper readiness false, and enqueues relevance by default', async () => {
        await applyUpsertedMapData(conn, true, 'map-1', legend, event);

        expect(replaceMapDataLegendItems).toHaveBeenCalledWith(conn, 'map-1', legend);
        expect(upsertPageZipperMapDataLegendItemsReady).toHaveBeenCalledWith(
            conn,
            'page-1',
            PageDataSource.Ropewiki,
            'map-1',
            { s1: false },
        );
        expect(upsertRelevanceContextJob).toHaveBeenCalledWith(conn, {
            mapDataId: 'map-1',
            pageId: 'page-1',
            pageSource: PageDataSource.Ropewiki,
            makeDownloadFolder: true,
        });
    });

    it('skips relevance job and marks legend keys ready when processRelevantContext is false', async () => {
        const noRelevance = new MapDataEvent(
            PageDataSource.Ropewiki,
            'route-1',
            'page-1',
            'map-1',
            true,
            false,
            false,
        );

        await applyUpsertedMapData(conn, true, 'map-1', legend, noRelevance);

        expect(replaceMapDataLegendItems).toHaveBeenCalledWith(conn, 'map-1', legend);
        expect(upsertPageZipperMapDataLegendItemsReady).toHaveBeenCalledWith(
            conn,
            'page-1',
            PageDataSource.Ropewiki,
            'map-1',
            { s1: true },
        );
        expect(upsertRelevanceContextJob).not.toHaveBeenCalled();
    });

    it('skips PageZipper upsert when makeDownloadFolder is false', async () => {
        const noFolder = new MapDataEvent(
            PageDataSource.Ropewiki,
            'route-1',
            'page-1',
            'map-1',
            true,
            false,
            true,
            false,
        );

        await applyUpsertedMapData(conn, true, 'map-1', legend, noFolder);

        expect(upsertPageZipperMapDataLegendItemsReady).not.toHaveBeenCalled();
        expect(upsertRelevanceContextJob).toHaveBeenCalledWith(conn, {
            mapDataId: 'map-1',
            pageId: 'page-1',
            pageSource: PageDataSource.Ropewiki,
            makeDownloadFolder: false,
        });
    });
});
