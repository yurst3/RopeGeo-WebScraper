import type * as s from 'zapatos/schema';
import * as db from 'zapatos/db';
import type { LegendItem } from 'ropegeo-common/models';
import {
    LegendFeatureType,
    LegendItem as LegendItemClass,
    LineLegendItem,
    PointLegendItem,
    PolygonLegendItem,
} from 'ropegeo-common/models';

export type MapDataLegendRows = {
    markerRows: s.MapDataMarkerLegendItem.JSONSelectable[];
    segmentRows: s.MapDataSegmentLegendItem.JSONSelectable[];
    polygonRows: s.MapDataPolygonLegendItem.JSONSelectable[];
};

export type MapDataLegendInsertRows = {
    markerRows: s.MapDataMarkerLegendItem.Insertable[];
    segmentRows: s.MapDataSegmentLegendItem.Insertable[];
    polygonRows: s.MapDataPolygonLegendItem.Insertable[];
};

export function legendInsertRowsFromLegend(
    mapDataId: string,
    legend: Record<string, LegendItem>,
): MapDataLegendInsertRows {
    const now = new Date();
    const markerRows: s.MapDataMarkerLegendItem.Insertable[] = [];
    const segmentRows: s.MapDataSegmentLegendItem.Insertable[] = [];
    const polygonRows: s.MapDataPolygonLegendItem.Insertable[] = [];

    for (const item of Object.values(legend)) {
        if (item instanceof PointLegendItem) {
            markerRows.push({
                id: item.id,
                mapData: mapDataId,
                name: item.name,
                coordinates: item.toPlain().coordinates as db.JSONValue,
                icon: item.icon ?? null,
                updatedAt: now,
            });
            continue;
        }
        if (item instanceof LineLegendItem) {
            segmentRows.push({
                id: item.id,
                mapData: mapDataId,
                name: item.name,
                bounds: item.toPlain().bounds as db.JSONValue,
                strokeColor: item.strokeColor ?? null,
                strokeWidth: item.strokeWidth ?? null,
                updatedAt: now,
            });
            continue;
        }
        if (item instanceof PolygonLegendItem) {
            polygonRows.push({
                id: item.id,
                mapData: mapDataId,
                name: item.name,
                bounds: item.toPlain().bounds as db.JSONValue,
                borderColor: item.borderColor ?? null,
                fillColor: item.fillColor ?? null,
                updatedAt: now,
            });
        }
    }

    return { markerRows, segmentRows, polygonRows };
}

function markerRowToPlain(row: s.MapDataMarkerLegendItem.JSONSelectable): Record<string, unknown> {
    const out: Record<string, unknown> = {
        featureType: LegendFeatureType.Point,
        id: row.id,
        name: row.name,
        coordinates: row.coordinates,
    };
    if (row.icon != null) out.icon = row.icon;
    return out;
}

function segmentRowToPlain(row: s.MapDataSegmentLegendItem.JSONSelectable): Record<string, unknown> {
    const out: Record<string, unknown> = {
        featureType: LegendFeatureType.Line,
        id: row.id,
        name: row.name,
        bounds: row.bounds,
    };
    if (row.strokeColor != null) out.strokeColor = row.strokeColor;
    if (row.strokeWidth != null) out.strokeWidth = row.strokeWidth;
    return out;
}

function polygonRowToPlain(row: s.MapDataPolygonLegendItem.JSONSelectable): Record<string, unknown> {
    const out: Record<string, unknown> = {
        featureType: LegendFeatureType.Polygon,
        id: row.id,
        name: row.name,
        bounds: row.bounds,
    };
    if (row.borderColor != null) out.borderColor = row.borderColor;
    if (row.fillColor != null) out.fillColor = row.fillColor;
    return out;
}

/** Builds `Record<string, LegendItem>` keyed by legend item id. */
export function legendRecordFromRows(rows: MapDataLegendRows): Record<string, LegendItem> {
    const out: Record<string, LegendItem> = {};
    for (const row of rows.markerRows) {
        out[row.id] = LegendItemClass.fromResult(markerRowToPlain(row));
    }
    for (const row of rows.segmentRows) {
        out[row.id] = LegendItemClass.fromResult(segmentRowToPlain(row));
    }
    for (const row of rows.polygonRows) {
        out[row.id] = LegendItemClass.fromResult(polygonRowToPlain(row));
    }
    return out;
}

export function hasLegendRows(rows: MapDataLegendRows): boolean {
    return rows.markerRows.length > 0 || rows.segmentRows.length > 0 || rows.polygonRows.length > 0;
}
