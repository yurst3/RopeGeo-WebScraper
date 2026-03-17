/**
 * Builds the public URL for an object (or key prefix) in the map data bucket.
 * When MAP_DATA_PUBLIC_BASE_URL is set (e.g. CloudFront URL), uses that so traffic goes through CloudFront.
 */
export function buildMapDataPublicUrl(bucket: string, key: string): string {
    const base = process.env.MAP_DATA_PUBLIC_BASE_URL;
    if (base) {
        const normalized = base.replace(/\/$/, '');
        return `${normalized}/mapdata/${key}`;
    }
    return `https://${bucket}.s3.amazonaws.com/${key}`;
}

const TILES_TEMPLATE_SUFFIX = '/{z}/{x}/{y}.pbf';

/**
 * Builds the tile URL template from a base URL or path (e.g. tiles directory URL or local path).
 * Ensures exactly one slash between the base and the template suffix.
 */
export function buildMapDataTilesTemplate(baseUrlOrPath: string): string {
    const normalized = baseUrlOrPath.replace(/\/$/, '');
    return `${normalized}${TILES_TEMPLATE_SUFFIX}`;
}
