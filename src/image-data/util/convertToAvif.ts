import sharp from 'sharp';

const PREVIEW_SIZE = 256;
const PREVIEW_QUALITY = 50;
const BANNER_QUALITY = 75;

export interface AvifOutputs {
    preview: Buffer;
    banner: Buffer;
    full: Buffer;
}

/**
 * Converts an image (file path or buffer) to three AVIF variants using Sharp.
 * - Preview: resized to 256x256 (fit inside), quality 50
 * - Banner: same dimensions as source, quality 75
 * - Full: same dimensions, lossless
 *
 * @param source - Path to the source image file, or buffer (e.g. PNG from single-page PDF)
 * @returns Buffers for preview.avif, banner.avif, full.avif
 */
export async function convertToAvif(source: string | Buffer): Promise<AvifOutputs> {
    const pipeline = sharp(source);

    const [preview, banner, full] = await Promise.all([
        pipeline
            .clone()
            .resize(PREVIEW_SIZE, PREVIEW_SIZE, { fit: 'inside', withoutEnlargement: true })
            .avif({ quality: PREVIEW_QUALITY })
            .toBuffer(),
        pipeline.clone().avif({ quality: BANNER_QUALITY }).toBuffer(),
        pipeline
            .clone()
            .avif({ lossless: true, chromaSubsampling: '4:4:4', effort: 5 })
            .toBuffer(),
    ]);

    return { preview, banner, full };
}
