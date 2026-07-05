import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import {
    Bounds,
    LineLegendItem,
    PointLegendItem,
    PolygonLegendItem,
} from 'ropegeo-common/models';
import getMapDataLegendItems from '../../../src/map-data/database/getMapDataLegendItems';
import replaceMapDataLegendItems from '../../../src/map-data/database/replaceMapDataLegendItems';
import { legendRecordFromRows } from '../../../src/map-data/types/mapDataLegendItem';

describe('mapData legend item database helpers (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;
    const mapDataId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const bounds = new Bounds(40, 39, -110, -111);

    beforeAll(async () => {
        await db.sql`DELETE FROM "MapData"`.run(conn);
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "MapData"`.run(conn);
    });

    afterAll(async () => {
        await pool.end();
    });

    async function insertMapDataRow(): Promise<void> {
        await db
            .insert('MapData', {
                id: mapDataId,
                sourceFileUrl: 'https://example.com/source.gpx',
            })
            .run(conn);
    }

    it('replaceMapDataLegendItems inserts marker, segment, and polygon rows', async () => {
        await insertMapDataRow();

        await replaceMapDataLegendItems(conn, mapDataId, {
            m1: new PointLegendItem('m1', 'Trailhead', { lat: 40.5, lon: -111.0 }, 'campground'),
            s1: new LineLegendItem('s1', 'Main line', bounds, '#00f', '2'),
            p1: new PolygonLegendItem('p1', 'Private land', bounds, '#111', '#eee'),
        });

        const [markers, segments, polygons] = await Promise.all([
            db.select('MapDataMarkerLegendItem', { mapData: mapDataId }).run(conn),
            db.select('MapDataSegmentLegendItem', { mapData: mapDataId }).run(conn),
            db.select('MapDataPolygonLegendItem', { mapData: mapDataId }).run(conn),
        ]);

        expect(markers).toHaveLength(1);
        expect(markers[0]!.id).toBe('m1');
        expect(markers[0]!.icon).toBe('campground');
        expect(segments).toHaveLength(1);
        expect(segments[0]!.strokeColor).toBe('#00f');
        expect(polygons).toHaveLength(1);
        expect(polygons[0]!.fillColor).toBe('#eee');
    });

    it('replaceMapDataLegendItems replaces existing rows on subsequent calls', async () => {
        await insertMapDataRow();

        await replaceMapDataLegendItems(conn, mapDataId, {
            old: new LineLegendItem('old', 'Old', bounds),
        });
        await replaceMapDataLegendItems(conn, mapDataId, {
            next: new LineLegendItem('next', 'Next', bounds),
        });

        const segments = await db
            .select('MapDataSegmentLegendItem', { mapData: mapDataId })
            .run(conn);
        expect(segments).toHaveLength(1);
        expect(segments[0]!.id).toBe('next');
    });

    it('replaceMapDataLegendItems clears all legend rows when legend is empty', async () => {
        await insertMapDataRow();
        await replaceMapDataLegendItems(conn, mapDataId, {
            s1: new LineLegendItem('s1', 'Line', bounds),
        });

        await replaceMapDataLegendItems(conn, mapDataId, undefined);

        const rows = await getMapDataLegendItems(conn, mapDataId);
        expect(rows.markerRows).toHaveLength(0);
        expect(rows.segmentRows).toHaveLength(0);
        expect(rows.polygonRows).toHaveLength(0);
    });

    it('getMapDataLegendItems returns rows that round-trip through legendRecordFromRows', async () => {
        await insertMapDataRow();
        await replaceMapDataLegendItems(conn, mapDataId, {
            s1: new LineLegendItem('s1', 'Segment', bounds, '#abc', '4'),
        });

        const rows = await getMapDataLegendItems(conn, mapDataId);
        const record = legendRecordFromRows(rows);

        expect(record.s1).toBeInstanceOf(LineLegendItem);
        expect(record.s1.name).toBe('Segment');
        expect((record.s1 as LineLegendItem).strokeColor).toBe('#abc');
    });
});
