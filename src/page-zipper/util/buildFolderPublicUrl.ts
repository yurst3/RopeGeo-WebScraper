/**
 * Public HTTPS URL for a page download ZIP (`{pageId}.zip`).
 * Uses PAGE_ZIP_PUBLIC_BASE_URL when set (CloudFront `/page-zips/{pageId}.zip`).
 */
export function buildFolderPublicUrl(pageId: string): string {
    const base = process.env.PAGE_ZIP_PUBLIC_BASE_URL?.trim();
    if (base) {
        return `${base.replace(/\/$/, '')}/${pageId}.zip`;
    }
    const bucket = process.env.PAGE_ZIP_BUCKET_NAME?.trim();
    if (!bucket) {
        throw new Error('PAGE_ZIP_PUBLIC_BASE_URL or PAGE_ZIP_BUCKET_NAME must be set');
    }
    return `https://${bucket}.s3.amazonaws.com/${pageId}.zip`;
}
