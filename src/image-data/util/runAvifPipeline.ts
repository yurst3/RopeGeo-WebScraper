import sharp from 'sharp';
import { stat } from 'fs/promises';
import { Metadata, ImageMetadata, Orientation } from '../types/metadata';

const PREVIEW_SIZE = 256;
const PREVIEW_QUALITY = 50;
const BANNER_SIZE = 512;
const BANNER_QUALITY = 75;
const FULL_QUALITY = 75;

export interface AvifOutputs {
    preview: Buffer;
    banner: Buffer;
    full: Buffer;
    lossless: Buffer;
    metadata: Metadata;
}

async function getSourceSizeKb(source: string | Buffer): Promise<number> {
    if (Buffer.isBuffer(source)) {
        return Math.round((source.length / 1024) * 100) / 100;
    }
    const s = await stat(source);
    return Math.round((s.size / 1024) * 100) / 100;
}

/**
 * Runs the Sharp pipeline to produce four AVIF variants and metadata.
 * - Preview: resized to 256x256 (fit inside), quality 50
 * - Banner: resized to 512 (fit inside), quality 75
 * - Full: original dimensions, quality 75
 * - Lossless: original dimensions, lossless
 *
 * Reads source metadata (including EXIF orientation) before applying rotate, so the stored
 * source orientation is correct; the pipeline then applies rotate so all outputs have orientation 1.
 *
 * @param source - Path to the source image file, or buffer (e.g. PNG from single-page PDF)
 * @returns Buffers for preview.avif, banner.avif, full.avif, lossless.avif and metadata for each
 */
export async function runAvifPipeline(source: string | Buffer): Promise<AvifOutputs> {
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
    const sourceMeta: ImageMetadata = {
        sizeKB: sourceSizeKb,
        dimensions: { width: sw, height: sh },
        orientation: sourceOrientation,
    };

    const pipeline = sharp(source).rotate();

    const [previewResult, bannerResult, fullResult, losslessResult] = await Promise.all([
        pipeline
            .clone()
            .resize(PREVIEW_SIZE, PREVIEW_SIZE, { fit: 'inside', withoutEnlargement: true })
            .avif({ quality: PREVIEW_QUALITY })
            .toBuffer({ resolveWithObject: true }),
        pipeline
            .clone()
            .resize(BANNER_SIZE, BANNER_SIZE, { fit: 'inside', withoutEnlargement: true })
            .avif({ quality: BANNER_QUALITY })
            .toBuffer({ resolveWithObject: true }),
        pipeline
            .clone()
            .avif({ quality: FULL_QUALITY })
            .toBuffer({ resolveWithObject: true }),
        pipeline
            .clone()
            .avif({ lossless: true, chromaSubsampling: '4:4:4', effort: 5 })
            .toBuffer({ resolveWithObject: true }),
    ]);

    const metadata = Metadata.fromResults({
        preview: { ...previewResult, quality: PREVIEW_QUALITY },
        banner: { ...bannerResult, quality: BANNER_QUALITY },
        full: { ...fullResult, quality: FULL_QUALITY },
        lossless: losslessResult,
        source: sourceMeta,
    });

    return {
        preview: previewResult.data,
        banner: bannerResult.data,
        full: fullResult.data,
        lossless: losslessResult.data,
        metadata,
    };
}
