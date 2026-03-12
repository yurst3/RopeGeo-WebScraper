const MAX_ATTEMPTS = 5;
const INITIAL_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Performs a HEAD request to the given URL and returns size in KB from Content-Length.
 * Retries up to 5 times with exponential backoff on failure or non-2xx.
 *
 * @param sourceUrl - URL to HEAD (e.g. source image URL)
 * @returns { sizeKB } on success, or null if all attempts fail or Content-Length is missing/invalid
 */
export async function headSourceSizeKb(sourceUrl: string): Promise<{ sizeKB: number } | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const response = await fetch(sourceUrl, { method: 'HEAD' });

            if (!response.ok) {
                lastError = new Error(`HEAD ${sourceUrl} returned ${response.status}`);
                if (attempt < MAX_ATTEMPTS) {
                    const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
                    await sleep(delay);
                }
                continue;
            }

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
            lastError = err instanceof Error ? err : new Error(String(err));
            if (attempt < MAX_ATTEMPTS) {
                const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
                await sleep(delay);
            }
        }
    }

    if (lastError) {
        console.warn(`headSourceSizeKb failed after ${MAX_ATTEMPTS} attempts:`, lastError.message);
    }
    return null;
}
