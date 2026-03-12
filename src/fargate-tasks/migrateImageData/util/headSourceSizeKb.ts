import httpRequest from '../../../helpers/httpRequest';

const RETRY_COUNT = 5;

/**
 * Performs a HEAD request to the given URL and returns size in KB from Content-Length.
 * Uses httpRequest so requests go through the proxy (when configured) and benefit from
 * its retry and timeout logic.
 *
 * @param sourceUrl - URL to HEAD (e.g. source image URL)
 * @param useProxy - When true, force use of proxy (e.g. from Fargate where isLambda is false). When undefined, use default.
 * @returns { sizeKB } on success, or null if request fails or Content-Length is missing/invalid
 */
export async function headSourceSizeKb(
    sourceUrl: string,
    useProxy?: boolean,
): Promise<{ sizeKB: number } | null> {
    try {
        const response = await httpRequest(
            sourceUrl,
            RETRY_COUNT,
            undefined,
            { method: 'HEAD' },
            useProxy,
        );

        const contentLength = response.headers.get('Content-Length');
        if (contentLength == null || contentLength === '') {
            return null;
        }
        const bytes = parseInt(contentLength, 10);
        if (Number.isNaN(bytes) || bytes < 0) {
            return null;
        }
        const sizeKB = Math.round((bytes / 1024) * 100) / 100;
        return { sizeKB };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn('headSourceSizeKb failed:', message);
        return null;
    }
}
