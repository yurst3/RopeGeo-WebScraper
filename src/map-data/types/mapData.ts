import type * as s from 'zapatos/schema';

export interface Bounds {
    north: number;
    south: number;
    east: number;
    west: number;
}

export class MapData {
    id: string | undefined;
    gpx: string | undefined;
    kml: string | undefined;
    geoJson: string | undefined;
    tilesTemplate: string | undefined;
    bounds: Bounds | null | undefined;
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
        this.sourceFileUrl = sourceFileUrl ?? '';
        this.errorMessage = errorMessage;
    }

    setBounds(bounds: Bounds | null | undefined): void {
        this.bounds = bounds;
    }

    toDbRow(): s.MapData.Insertable {
        const now = new Date();
        const row: s.MapData.Insertable = {
            gpx: this.gpx ?? null,
            kml: this.kml ?? null,
            geoJson: this.geoJson ?? null,
            tilesTemplate: this.tilesTemplate ?? null,
            bounds: this.bounds ?? null,
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
        mapData.bounds = (row.bounds as Bounds | null) ?? undefined;
        return mapData;
    }
}

export default MapData;
