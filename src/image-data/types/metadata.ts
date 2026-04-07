import { ImageVersion, VERSION_FORMAT } from 'ropegeo-common/models';

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
    /** AVIF/JPEG quality (0–100); omitted for lossless and sometimes source */
    quality?: number;
    /** IANA media type for this rendition (e.g. image/avif, image/jpeg). */
    mimeType?: string;
}

/** JSON-serializable shape for DB and IPC */
export interface ImageMetadataJSON {
    sizeKB: number;
    dimensions: { width: number; height: number };
    orientation: number;
    quality?: number;
    mimeType?: string;
}

const IMAGE_VERSION_SET = new Set<string>(Object.values(ImageVersion));

/**
 * Per-variant metadata for encoded outputs ({@link ImageVersion}) plus separate `source`.
 * Use bracket access for variants, e.g. `m[ImageVersion.banner]` (same idea as {@link ImageVersions} in ropegeo-common).
 * JSON shape: { preview?, linkPreview?, banner?, full?, lossless?, source? }.
 */
export class Metadata {
    #source: ImageMetadata | null;

    get source(): ImageMetadata | null {
        return this.#source;
    }

    /**
     * @param init - Variant slots; omit for source-only construction, e.g. `new Metadata(undefined, sourceMeta)`.
     */
    constructor(
        init?: Partial<Record<ImageVersion, ImageMetadata | null>>,
        source?: ImageMetadata | null,
    ) {
        const self = this as Partial<Record<ImageVersion, ImageMetadata | null>>;
        const initObj = init ?? {};
        for (const v of Object.values(ImageVersion)) {
            if (Object.prototype.hasOwnProperty.call(initObj, v)) {
                const val = initObj[v];
                if (val !== undefined) {
                    self[v] = val;
                }
            }
        }
        this.#source = source ?? null;
    }

    /** Overwrite or clear (null) metadata for one encoded variant. */
    setVersion(version: ImageVersion, meta: ImageMetadata | null): void {
        const self = this as Partial<Record<ImageVersion, ImageMetadata | null>>;
        self[version] = meta;
    }

    setSource(meta: ImageMetadata | null): void {
        this.#source = meta;
    }

    /** Full JSON for worker IPC / round-trip (all version keys + source). */
    toJSON(): Record<string, ImageMetadataJSON | null> {
        const self = this as Partial<Record<ImageVersion, ImageMetadata | null>>;
        const out: Record<string, ImageMetadataJSON | null> = {};
        for (const v of Object.values(ImageVersion)) {
            const m = self[v];
            out[v] = m != null ? toMetaJSON(m) : null;
        }
        out.source = this.source ? toMetaJSON(this.source) : null;
        return out;
    }

    /**
     * Fragment merged into existing DB jsonb (only keys present are written).
     */
    toMergeFragment(): Record<string, unknown> {
        const self = this as Partial<Record<ImageVersion, ImageMetadata | null>>;
        const out: Record<string, unknown> = {};
        for (const v of Object.values(ImageVersion)) {
            const m = self[v];
            if (m != null) {
                out[v] = toMetaJSON(m);
            }
        }
        if (this.source != null) {
            out.source = toMetaJSON(this.source);
        }
        return out;
    }

    static fromJSON(obj: unknown): Metadata {
        if (obj == null || typeof obj !== 'object') {
            return new Metadata();
        }
        const o = obj as Record<string, unknown>;
        const init: Partial<Record<ImageVersion, ImageMetadata | null>> = {};
        for (const key of Object.keys(o)) {
            if (key === 'source') {
                continue;
            }
            if (!IMAGE_VERSION_SET.has(key)) {
                throw new Error(`Metadata: unknown key "${key}"`);
            }
            init[key as ImageVersion] = fromMetaJSON(o[key]);
        }
        return new Metadata(init, fromMetaJSON(o.source));
    }

    /**
     * Writes encoded-output fields onto {@link metadata} for each entry in {@link variants} (mutates in place).
     */
    static applyEncodedVariants(
        metadata: Metadata,
        variants: Partial<
            Record<ImageVersion, { data: Buffer; info: { width: number; height: number }; quality?: number }>
        >,
    ): void {
        for (const v of Object.values(ImageVersion)) {
            const p = variants[v];
            if (p == null) {
                continue;
            }
            metadata.setVersion(v, {
                sizeKB: Math.round((p.data.length / 1024) * 100) / 100,
                dimensions: { width: p.info.width, height: p.info.height },
                orientation: Orientation.Normal,
                mimeType: VERSION_FORMAT[v],
                ...(p.quality !== undefined && { quality: p.quality }),
            });
        }
    }

    static fromPipelineResults(params: {
        variants: Partial<
            Record<ImageVersion, { data: Buffer; info: { width: number; height: number }; quality?: number }>
        >;
        source: ImageMetadata;
    }): Metadata {
        const m = new Metadata();
        Metadata.applyEncodedVariants(m, params.variants);
        m.setSource(params.source);
        return m;
    }
}

/** Bracket access for variant slots (instance fields are assigned in the constructor). */
export interface Metadata extends Partial<Record<ImageVersion, ImageMetadata | null>> {}

function toMetaJSON(m: ImageMetadata): ImageMetadataJSON {
    return {
        sizeKB: m.sizeKB,
        dimensions: m.dimensions,
        orientation: m.orientation,
        ...(m.quality !== undefined && { quality: m.quality }),
        ...(m.mimeType !== undefined && { mimeType: m.mimeType }),
    };
}

function fromMetaJSON(v: unknown): ImageMetadata | null {
    if (v == null || typeof v !== 'object') return null;
    const o = v as Record<string, unknown>;
    const sizeKB =
        typeof o.sizeKB === 'number'
            ? o.sizeKB
            : typeof (o as { size?: number }).size === 'number'
              ? (o as { size: number }).size
              : 0;
    const dimensions =
        o.dimensions && typeof o.dimensions === 'object' && !Array.isArray(o.dimensions)
            ? {
                  width:
                      typeof (o.dimensions as Record<string, unknown>).width === 'number'
                          ? (o.dimensions as { width: number }).width
                          : 0,
                  height:
                      typeof (o.dimensions as Record<string, unknown>).height === 'number'
                          ? (o.dimensions as { height: number }).height
                          : 0,
              }
            : { width: 0, height: 0 };
    const orientation =
        typeof o.orientation === 'number' && o.orientation >= 1 && o.orientation <= 8
            ? (o.orientation as Orientation)
            : Orientation.Normal;
    const quality = typeof o.quality === 'number' ? o.quality : undefined;
    const mimeType = typeof o.mimeType === 'string' ? o.mimeType : undefined;
    return { sizeKB, dimensions, orientation, ...(quality !== undefined && { quality }), ...(mimeType !== undefined && { mimeType }) };
}
