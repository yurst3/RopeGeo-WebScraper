import type * as s from 'zapatos/schema';

export enum PageDataSource {
    Ropewiki = 'ropewiki',
}

export class MapData {
    id: string | undefined;
    gpx: string | undefined;
    kml: string | undefined;
    geoJson: string | undefined;
    vectorTile: string | undefined;

    constructor(
        gpx?: string,
        kml?: string,
        geoJson?: string,
        vectorTile?: string,
        id?: string,
    ) {
        this.gpx = gpx;
        this.kml = kml;
        this.geoJson = geoJson;
        this.vectorTile = vectorTile;
        this.id = id;
    }

    toDbRow(): s.MapData.Insertable {
        const now = new Date();
        const row: s.MapData.Insertable = {
            gpx: this.gpx ?? null,
            kml: this.kml ?? null,
            geoJson: this.geoJson ?? null,
            vectorTile: this.vectorTile ?? null,
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
            row.vectorTile ?? undefined,
            row.id,
        );
    }
}

export default MapData;
