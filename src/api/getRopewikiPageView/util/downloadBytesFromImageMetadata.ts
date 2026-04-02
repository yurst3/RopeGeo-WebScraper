import { DownloadBytes, ImageVersion } from 'ropegeo-common/classes';
import type { ImageMetadata } from '../../../image-data/types/metadata';
import { Metadata } from '../../../image-data/types/metadata';

/**
 * Converts stored ImageData.metadata (JSON) to approximate byte sizes for each rendition.
 * Uses sizeKB from pipeline metadata (rounded to bytes).
 */
function sizeBytesFromMeta(im: ImageMetadata | null): number {
    if (im == null) return 0;
    return Math.max(0, Math.round(im.sizeKB * 1024));
}

/**
 * Builds DownloadBytes for the page banner (preview + banner + full renditions).
 */
export function downloadBytesForBannerImage(
    metadata: unknown,
): DownloadBytes | null {
    if (metadata == null) return null;
    const m = Metadata.fromJSON(metadata);
    return new DownloadBytes(
        sizeBytesFromMeta(m[ImageVersion.preview] ?? null),
        sizeBytesFromMeta(m[ImageVersion.banner] ?? null),
        sizeBytesFromMeta(m[ImageVersion.full] ?? null),
    );
}

/**
 * Builds DownloadBytes for beta-section images: preview is always 0 (beta pipeline skips preview);
 * banner and full reflect stored sizes.
 */
export function downloadBytesForBetaSectionImage(
    metadata: unknown,
): DownloadBytes | null {
    if (metadata == null) return null;
    const m = Metadata.fromJSON(metadata);
    return new DownloadBytes(
        0,
        sizeBytesFromMeta(m[ImageVersion.banner] ?? null),
        sizeBytesFromMeta(m[ImageVersion.full] ?? null),
    );
}
