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
