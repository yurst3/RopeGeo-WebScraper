import type * as s from 'zapatos/schema';

export class MapData {
    id: string | undefined;
    gpx: string | undefined;
    kml: string | undefined;
    geoJson: string | undefined;
    tiles: string | undefined;
    sourceFileUrl: string;
    errorMessage: string | undefined;

    constructor(
        gpx?: string,
        kml?: string,
        geoJson?: string,
        tiles?: string,
        id?: string,
        sourceFileUrl?: string,
        errorMessage?: string,
    ) {
        this.gpx = gpx;
        this.kml = kml;
        this.geoJson = geoJson;
        this.tiles = tiles;
        this.id = id;
        this.sourceFileUrl = sourceFileUrl ?? '';
        this.errorMessage = errorMessage;
    }

    toDbRow(): s.MapData.Insertable {
        const now = new Date();
        const row: s.MapData.Insertable = {
            gpx: this.gpx ?? null,
            kml: this.kml ?? null,
            geoJson: this.geoJson ?? null,
            tiles: this.tiles ?? null,
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
        return new MapData(
            row.gpx ?? undefined,
            row.kml ?? undefined,
            row.geoJson ?? undefined,
            row.tiles ?? undefined,
            row.id,
            row.sourceFileUrl,
            row.errorMessage ?? undefined,
        );
    }
}

export default MapData;
