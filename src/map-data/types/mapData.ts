import type * as s from 'zapatos/schema';

export enum PageDataSource {
    Ropewiki = 'ropewiki',
}

export class MapData {
    id: string | undefined;
    gpxUrl: string | undefined;
    kmlUrl: string | undefined;
    geoJsonUrl: string | undefined;
    vectorTileUrl: string | undefined;
    deletedAt: Date | undefined;

    constructor(
        gpxUrl?: string,
        kmlUrl?: string,
        geoJsonUrl?: string,
        vectorTileUrl?: string,
        deletedAt?: Date,
        id?: string,
    ) {
        this.gpxUrl = gpxUrl;
        this.kmlUrl = kmlUrl;
        this.geoJsonUrl = geoJsonUrl;
        this.vectorTileUrl = vectorTileUrl;
        this.deletedAt = deletedAt;
        this.id = id;
    }

    toDbRow(): s.MapData.Insertable {
        const now = new Date();
        const row: s.MapData.Insertable = {
            gpxUrl: this.gpxUrl ?? null,
            kmlUrl: this.kmlUrl ?? null,
            geoJsonUrl: this.geoJsonUrl ?? null,
            vectorTileUrl: this.vectorTileUrl ?? null,
            updatedAt: now,
            deletedAt: this.deletedAt ?? null,
        };

        // Only include id if it's set (non-empty), allowing the database default to generate it
        if (this.id) {
            row.id = this.id;
        }

        return row;
    }

    static fromDbRow(row: s.MapData.JSONSelectable): MapData {
        return new MapData(
            row.gpxUrl ?? undefined,
            row.kmlUrl ?? undefined,
            row.geoJsonUrl ?? undefined,
            row.vectorTileUrl ?? undefined,
            row.deletedAt ? new Date(row.deletedAt) : undefined,
            row.id,
        );
    }
}

export default MapData;
