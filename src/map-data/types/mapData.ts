import type * as s from 'zapatos/schema';
import * as db from 'zapatos/db';
import { Bounds } from 'ropegeo-common/models';

export class MapData {
    id: string | undefined;
    gpx: string | undefined;
    kml: string | undefined;
    geoJson: string | undefined;
    tilesTemplate: string | undefined;
    bounds: Bounds | undefined;
    tileCount: number;
    tileTotalBytes: number;
    sourceFileUrl: string;
    errorMessage: string | undefined;
    authors: string[] | null;

    constructor(
        gpx?: string,
        kml?: string,
        geoJson?: string,
        tilesTemplate?: string,
        id?: string,
        sourceFileUrl?: string,
        errorMessage?: string,
        authors: string[] | null = null,
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
        this.authors = authors;
    }

    setTileCounts(tileCount: number, tileTotalBytes: number): void {
        this.tileCount = tileCount;
        this.tileTotalBytes = tileTotalBytes;
    }

    setBounds(bounds: Bounds | null ): void {
        this.bounds = bounds ?? undefined;
    }

    setAuthors(authors: string[] | null): void {
        this.authors = authors;
    }

    toDbRow(): s.MapData.Insertable {
        const now = new Date();
        const row: s.MapData.Insertable = {
            gpx: this.gpx ?? null,
            kml: this.kml ?? null,
            geoJson: this.geoJson ?? null,
            tilesTemplate: this.tilesTemplate ?? null,
            bounds: (this.bounds ?? null) as db.JSONValue | null,
            tileCount: this.tileCount,
            tileTotalBytes: this.tileTotalBytes,
            sourceFileUrl: this.sourceFileUrl,
            errorMessage: this.errorMessage ?? null,
            authors: this.authors,
            updatedAt: now,
            deletedAt: null,
        };

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
            row.authors ?? null,
        );
        mapData.bounds =
            row.bounds != null ? Bounds.fromResult(row.bounds) : undefined;
        mapData.tileCount = row.tileCount ?? 0;
        mapData.tileTotalBytes =
            row.tileTotalBytes == null ? 0 : Number(row.tileTotalBytes);
        return mapData;
    }
}

export default MapData;
