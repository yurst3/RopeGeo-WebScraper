/**
 * EXIF orientation values 1–8. Keys describe the display transformation.
 * @see https://exiftool.org/TagNames/EXIF.html (Orientation)
 */
export enum Orientation {
    Normal = 1,
    MirroredHorizontal = 2,
    Rotated180 = 3,
    MirroredVertical = 4,
    MirroredHorizontalRotated270CW = 5,
    Rotated90CW = 6,
    MirroredHorizontalRotated90CW = 7,
    Rotated270CW = 8,
}

export interface ImageMetadata {
    /** File size in kilobytes */
    sizeKB: number;
    dimensions: { width: number; height: number };
    orientation: Orientation;
    /** AVIF quality (0–100); omitted for lossless and source */
    quality?: number;
}

/** JSON-serializable shape for DB and IPC */
export interface ImageMetadataJSON {
    sizeKB: number;
    dimensions: { width: number; height: number };
    orientation: number;
    quality?: number;
}

/** Container for per-variant metadata (preview, banner, full, lossless, source). */
export class Metadata {
    preview: ImageMetadata | null;
    banner: ImageMetadata | null;
    full: ImageMetadata | null;
    lossless: ImageMetadata | null;
    source: ImageMetadata | null;

    constructor(
        preview: ImageMetadata | null = null,
        banner: ImageMetadata | null = null,
        full: ImageMetadata | null = null,
        lossless: ImageMetadata | null = null,
        source: ImageMetadata | null = null,
    ) {
        this.preview = preview;
        this.banner = banner;
        this.full = full;
        this.lossless = lossless;
        this.source = source;
    }

    toJSON(): {
        preview: ImageMetadataJSON | null;
        banner: ImageMetadataJSON | null;
        full: ImageMetadataJSON | null;
        lossless: ImageMetadataJSON | null;
        source: ImageMetadataJSON | null;
    } {
        return {
            preview: this.preview ? toMetaJSON(this.preview) : null,
            banner: this.banner ? toMetaJSON(this.banner) : null,
            full: this.full ? toMetaJSON(this.full) : null,
            lossless: this.lossless ? toMetaJSON(this.lossless) : null,
            source: this.source ? toMetaJSON(this.source) : null,
        };
    }

    static fromJSON(obj: unknown): Metadata {
        if (obj == null || typeof obj !== 'object') {
            return new Metadata();
        }
        const o = obj as Record<string, unknown>;
        return new Metadata(
            fromMetaJSON(o.preview),
            fromMetaJSON(o.banner),
            fromMetaJSON(o.full),
            fromMetaJSON(o.lossless),
            fromMetaJSON(o.source),
        );
    }

    /**
     * Build metadata from pipeline results (buffer + dimensions for each variant) and source metadata.
     * Output variants use orientation Normal (1); source keeps its original EXIF orientation.
     * Pass optional quality for preview, banner, full; omit for lossless and source.
     */
    static fromResults(params: {
        preview: { data: Buffer; info: { width: number; height: number }; quality?: number };
        banner: { data: Buffer; info: { width: number; height: number }; quality?: number };
        full: { data: Buffer; info: { width: number; height: number }; quality?: number };
        lossless: { data: Buffer; info: { width: number; height: number } };
        source: ImageMetadata;
    }): Metadata {
        const metaFromBuffer = (
            data: Buffer,
            width: number,
            height: number,
            quality?: number,
        ): ImageMetadata => ({
            sizeKB: Math.round((data.length / 1024) * 100) / 100,
            dimensions: { width, height },
            orientation: Orientation.Normal,
            ...(quality !== undefined && { quality }),
        });
        return new Metadata(
            metaFromBuffer(
                params.preview.data,
                params.preview.info.width,
                params.preview.info.height,
                params.preview.quality,
            ),
            metaFromBuffer(
                params.banner.data,
                params.banner.info.width,
                params.banner.info.height,
                params.banner.quality,
            ),
            metaFromBuffer(
                params.full.data,
                params.full.info.width,
                params.full.info.height,
                params.full.quality,
            ),
            metaFromBuffer(params.lossless.data, params.lossless.info.width, params.lossless.info.height),
            params.source,
        );
    }
}

function toMetaJSON(m: ImageMetadata): ImageMetadataJSON {
    return {
        sizeKB: m.sizeKB,
        dimensions: m.dimensions,
        orientation: m.orientation,
        ...(m.quality !== undefined && { quality: m.quality }),
    };
}

function fromMetaJSON(v: unknown): ImageMetadata | null {
    if (v == null || typeof v !== 'object') return null;
    const o = v as Record<string, unknown>;
    const sizeKB =
        typeof o.sizeKB === 'number' ? o.sizeKB : typeof (o as { size?: number }).size === 'number' ? (o as { size: number }).size : 0;
    const dimensions = o.dimensions && typeof o.dimensions === 'object' && !Array.isArray(o.dimensions)
        ? {
            width: typeof (o.dimensions as Record<string, unknown>).width === 'number' ? (o.dimensions as { width: number }).width : 0,
            height: typeof (o.dimensions as Record<string, unknown>).height === 'number' ? (o.dimensions as { height: number }).height : 0,
        }
        : { width: 0, height: 0 };
    const orientation = typeof o.orientation === 'number' && o.orientation >= 1 && o.orientation <= 8
        ? (o.orientation as Orientation)
        : Orientation.Normal;
    const quality = typeof o.quality === 'number' ? o.quality : undefined;
    return { sizeKB, dimensions, orientation, ...(quality !== undefined && { quality }) };
}
