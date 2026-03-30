import sharp from 'sharp';
import { stat } from 'fs/promises';
import { ImageVersion } from 'ropegeo-common';
import { Metadata, ImageMetadata, Orientation } from '../types/metadata';

const PREVIEW_SIZE = 256;
const PREVIEW_QUALITY = 50;
const BANNER_SIZE = 512;
const BANNER_QUALITY = 75;
const FULL_QUALITY = 75;

async function getSourceSizeKb(source: string | Buffer): Promise<number> {
    if (Buffer.isBuffer(source)) {
        return Math.round((source.length / 1024) * 100) / 100;
    }
    const s = await stat(source);
    return Math.round((s.size / 1024) * 100) / 100;
}

function sharpFormatToMime(format: string | undefined): string | undefined {
    switch (format) {
        case 'jpeg':
            return 'image/jpeg';
        case 'png':
            return 'image/png';
        case 'webp':
            return 'image/webp';
        case 'gif':
            return 'image/gif';
        case 'tiff':
            return 'image/tiff';
        case 'avif':
            return 'image/avif';
        default:
            return undefined;
    }
}

type EncodeResult = {
    v: ImageVersion;
    data: Buffer;
    info: { width: number; height: number };
    quality?: number;
};

/**
 * Encodes the requested {@link ImageVersion} outputs from a raster source (path or buffer).
 * Uses Sharp; `linkPreview` matches preview geometry/quality but outputs JPEG (see ropegeo-common `VERSION_FORMAT`).
 * When {@link existingMetadata} is set, updates a copy of it with new variant slots and fresh source stats; otherwise builds a new {@link Metadata}.
 */
export async function runSourceConversionPipeline(
    source: string | Buffer,
    versions: readonly ImageVersion[],
    existingMetadata?: Metadata,
): Promise<{
    buffers: Partial<Record<ImageVersion, Buffer>>;
    metadata: Metadata;
}> {
    const want = new Set(versions);
    const sourcePipeline = sharp(source);
    const [sourceMetaSharp, sourceSizeKb] = await Promise.all([
        sourcePipeline.metadata(),
        getSourceSizeKb(source),
    ]);
    const sw = sourceMetaSharp.width ?? 0;
    const sh = sourceMetaSharp.height ?? 0;
    const sourceOrientation =
        typeof sourceMetaSharp.orientation === 'number' &&
        sourceMetaSharp.orientation >= 1 &&
        sourceMetaSharp.orientation <= 8
            ? (sourceMetaSharp.orientation as Orientation)
            : Orientation.Normal;
    const sourceMime = sharpFormatToMime(sourceMetaSharp.format);
    const sourceMeta: ImageMetadata = {
        sizeKB: sourceSizeKb,
        dimensions: { width: sw, height: sh },
        orientation: sourceOrientation,
        ...(sourceMime !== undefined && { mimeType: sourceMime }),
    };

    const pipeline = sharp(source).rotate();
    const encodes: Promise<EncodeResult>[] = [];

    if (want.has(ImageVersion.preview)) {
        encodes.push(
            pipeline
                .clone()
                .resize(PREVIEW_SIZE, PREVIEW_SIZE, { fit: 'inside', withoutEnlargement: true })
                .avif({ quality: PREVIEW_QUALITY })
                .toBuffer({ resolveWithObject: true })
                .then((r) => ({
                    v: ImageVersion.preview,
                    data: r.data,
                    info: r.info,
                    quality: PREVIEW_QUALITY,
                })),
        );
    }
    if (want.has(ImageVersion.linkPreview)) {
        encodes.push(
            pipeline
                .clone()
                .resize(PREVIEW_SIZE, PREVIEW_SIZE, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: PREVIEW_QUALITY })
                .toBuffer({ resolveWithObject: true })
                .then((r) => ({
                    v: ImageVersion.linkPreview,
                    data: r.data,
                    info: r.info,
                    quality: PREVIEW_QUALITY,
                })),
        );
    }
    if (want.has(ImageVersion.banner)) {
        encodes.push(
            pipeline
                .clone()
                .resize(BANNER_SIZE, BANNER_SIZE, { fit: 'inside', withoutEnlargement: true })
                .avif({ quality: BANNER_QUALITY })
                .toBuffer({ resolveWithObject: true })
                .then((r) => ({
                    v: ImageVersion.banner,
                    data: r.data,
                    info: r.info,
                    quality: BANNER_QUALITY,
                })),
        );
    }
    if (want.has(ImageVersion.full)) {
        encodes.push(
            pipeline
                .clone()
                .avif({ quality: FULL_QUALITY })
                .toBuffer({ resolveWithObject: true })
                .then((r) => ({
                    v: ImageVersion.full,
                    data: r.data,
                    info: r.info,
                    quality: FULL_QUALITY,
                })),
        );
    }
    if (want.has(ImageVersion.lossless)) {
        encodes.push(
            pipeline
                .clone()
                .avif({ lossless: true, chromaSubsampling: '4:4:4', effort: 5 })
                .toBuffer({ resolveWithObject: true })
                .then((r) => ({
                    v: ImageVersion.lossless,
                    data: r.data,
                    info: r.info,
                })),
        );
    }

    const results = await Promise.all(encodes);
    const variants: Partial<
        Record<ImageVersion, { data: Buffer; info: { width: number; height: number }; quality?: number }>
    > = {};
    const buffers: Partial<Record<ImageVersion, Buffer>> = {};
    for (const r of results) {
        variants[r.v] = {
            data: r.data,
            info: r.info,
            ...(r.quality !== undefined && { quality: r.quality }),
        };
        buffers[r.v] = r.data;
    }

    const metadata =
        existingMetadata != null ? Metadata.fromJSON(existingMetadata.toJSON()) : new Metadata();
    Metadata.applyEncodedVariants(metadata, variants);
    metadata.setSource(sourceMeta);
    return { buffers, metadata };
}
