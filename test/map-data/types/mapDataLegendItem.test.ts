import { describe, it, expect } from '@jest/globals';
import {
    Bounds,
    LegendFeatureType,
    LineLegendItem,
    PointLegendItem,
    PolygonLegendItem,
} from 'ropegeo-common/models';
import {
    hasLegendRows,
    legendInsertRowsFromLegend,
    legendRecordFromRows,
} from '../../../src/map-data/types/mapDataLegendItem';

describe('mapDataLegendItem', () => {
    const mapDataId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const bounds = new Bounds(40, 39, -110, -111);

    it('legendInsertRowsFromLegend routes items to the correct table rows', () => {
        const marker = new PointLegendItem('m1', 'Parking', { lat: 40.1, lon: -111.2 }, 'p');
        const segment = new LineLegendItem('s1', 'Approach', bounds, '#f00', '3');
        const polygon = new PolygonLegendItem('p1', 'Closure', bounds, '#000', '#ccc');

        const rows = legendInsertRowsFromLegend(mapDataId, {
            [marker.id]: marker,
            [segment.id]: segment,
            [polygon.id]: polygon,
        });

        expect(rows.markerRows).toHaveLength(1);
        expect(rows.markerRows[0]).toMatchObject({
            id: 'm1',
            mapData: mapDataId,
            name: 'Parking',
            icon: 'p',
        });
        expect(rows.segmentRows).toHaveLength(1);
        expect(rows.segmentRows[0]).toMatchObject({
            id: 's1',
            mapData: mapDataId,
            name: 'Approach',
            strokeColor: '#f00',
            strokeWidth: '3',
        });
        expect(rows.polygonRows).toHaveLength(1);
        expect(rows.polygonRows[0]).toMatchObject({
            id: 'p1',
            mapData: mapDataId,
            name: 'Closure',
            borderColor: '#000',
            fillColor: '#ccc',
        });
    });

    it('legendRecordFromRows rebuilds LegendItem instances keyed by id', () => {
        const marker = new PointLegendItem('m1', 'Parking', { lat: 40.1, lon: -111.2 });
        const segment = new LineLegendItem('s1', 'Approach', bounds);
        const polygon = new PolygonLegendItem('p1', 'Closure', bounds);
        const insertRows = legendInsertRowsFromLegend(mapDataId, {
            [marker.id]: marker,
            [segment.id]: segment,
            [polygon.id]: polygon,
        });

        const record = legendRecordFromRows({
            markerRows: insertRows.markerRows.map((row) => ({
                ...row,
                createdAt: new Date().toISOString() as never,
                updatedAt: new Date().toISOString() as never,
            })),
            segmentRows: insertRows.segmentRows.map((row) => ({
                ...row,
                createdAt: new Date().toISOString() as never,
                updatedAt: new Date().toISOString() as never,
            })),
            polygonRows: insertRows.polygonRows.map((row) => ({
                ...row,
                createdAt: new Date().toISOString() as never,
                updatedAt: new Date().toISOString() as never,
            })),
        });

        expect(record.m1).toBeInstanceOf(PointLegendItem);
        expect(record.m1.featureType).toBe(LegendFeatureType.Point);
        expect(record.s1).toBeInstanceOf(LineLegendItem);
        expect(record.s1.featureType).toBe(LegendFeatureType.Line);
        expect(record.p1).toBeInstanceOf(PolygonLegendItem);
        expect(record.p1.featureType).toBe(LegendFeatureType.Polygon);
    });

    it('hasLegendRows returns false for empty row sets', () => {
        expect(
            hasLegendRows({ markerRows: [], segmentRows: [], polygonRows: [] }),
        ).toBe(false);
    });

    it('hasLegendRows returns true when any table has rows', () => {
        expect(
            hasLegendRows({
                markerRows: [],
                segmentRows: [{ id: 's1' } as never],
                polygonRows: [],
            }),
        ).toBe(true);
    });
});
