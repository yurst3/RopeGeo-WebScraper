import type * as s from 'zapatos/schema';
import * as db from 'zapatos/db';
import {
    Bounds,
    LegendItem,
    LineLegendItem,
    PointLegendItem,
    PolygonLegendItem,
} from 'ropegeo-common/models';

/** Ensures ropegeo-common registers LegendItem.fromResult parsers before legendRecordFromResult. */
export const _legendParserSideEffect: unknown[] = [PointLegendItem, LineLegendItem, PolygonLegendItem];

export class MapData {
    id: string | undefined;
    gpx: string | undefined;
    kml: string | undefined;
    geoJson: string | undefined;
    tilesTemplate: string | undefined;
    bounds: Bounds | undefined;
    legend?: Record<string, LegendItem>;
    tileCount: number;
    tileTotalBytes: number;
    sourceFileUrl: string;
    errorMessage: string | undefined;

    constructor(
        gpx?: string,
        kml?: string,
        geoJson?: string,
        tilesTemplate?: string,
        id?: string,
        sourceFileUrl?: string,
        errorMessage?: string,
    ) {
        this.gpx = gpx;
        this.kml = kml;
        this.geoJson = geoJson;
        this.tilesTemplate = tilesTemplate;
        this.id = id;
        this.bounds = undefined;
        this.tileCount = 0;
        this.tileTotalBytes = 0;
        this.sourceFileUrl = sourceFileUrl ?? '';
        this.errorMessage = errorMessage;
    }

    setTileCounts(tileCount: number, tileTotalBytes: number): void {
        this.tileCount = tileCount;
        this.tileTotalBytes = tileTotalBytes;
    }

    setBounds(bounds: Bounds | null ): void {
        this.bounds = bounds ?? undefined;
    }

    setLegend(legend: Record<string, LegendItem> | null | undefined): void {
        if (legend == null || Object.keys(legend).length === 0) {
            delete this.legend;
        } else {
            this.legend = legend;
        }
    }

    toDbRow(): s.MapData.Insertable {
        const now = new Date();
        const legendJson =
            this.legend != null
                ? Object.fromEntries(
                      Object.entries(this.legend).map(([key, item]) => [key, item.toPlain()]),
                  )
                : null;
        const row: s.MapData.Insertable = {
            gpx: this.gpx ?? null,
            kml: this.kml ?? null,
            geoJson: this.geoJson ?? null,
            tilesTemplate: this.tilesTemplate ?? null,
            bounds: (this.bounds ?? null) as db.JSONValue | null,
            legend: legendJson as db.JSONValue | null,
            tileCount: this.tileCount,
            tileTotalBytes: this.tileTotalBytes,
            sourceFileUrl: this.sourceFileUrl,
            errorMessage: this.errorMessage ?? null,
            updatedAt: now,
            deletedAt: null,
        };

        // Only include id if it's set (non-empty), allowing the database default to generate it
        if (this.id) {
            row.id = this.id;
        }

        return row;
    }

    static fromDbRow(row: s.MapData.JSONSelectable): MapData {
        const mapData = new MapData(
            row.gpx ?? undefined,
            row.kml ?? undefined,
            row.geoJson ?? undefined,
            row.tilesTemplate ?? undefined,
            row.id,
            row.sourceFileUrl,
            row.errorMessage ?? undefined,
        );
        mapData.bounds =
            row.bounds != null ? Bounds.fromResult(row.bounds) : undefined;
        mapData.tileCount = row.tileCount ?? 0;
        mapData.tileTotalBytes =
            row.tileTotalBytes == null ? 0 : Number(row.tileTotalBytes);
        if (row.legend != null && typeof row.legend === 'object' && !Array.isArray(row.legend)) {
            try {
                const parsed = LegendItem.legendRecordFromResult(row.legend, 'MapData.legend');
                if (Object.keys(parsed).length > 0) {
                    mapData.legend = parsed;
                }
            } catch (e) {
                console.warn(
                    `MapData ${row.id}: invalid legend json, omitting:`,
                    e instanceof Error ? e.message : e,
                );
            }
        }
        return mapData;
    }
}

export default MapData;
