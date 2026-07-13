/**
 * Seconds to hide an SQS message after a relevance LLM failure before retry.
 * Reads MAP_DATA_RELEVANCE_ERROR_RETRY_VISIBILITY_TIMEOUT_SECONDS (0–43200).
 */
export function getRelevanceErrorRetryVisibilityTimeoutSeconds(): number {
    const raw = process.env.MAP_DATA_RELEVANCE_ERROR_RETRY_VISIBILITY_TIMEOUT_SECONDS;
    if (raw === undefined || raw === '') {
        throw new Error(
            'MAP_DATA_RELEVANCE_ERROR_RETRY_VISIBILITY_TIMEOUT_SECONDS environment variable is not set',
        );
    }
    const value = parseInt(raw, 10);
    if (Number.isNaN(value) || value < 0 || value > 43200) {
        throw new Error(
            `MAP_DATA_RELEVANCE_ERROR_RETRY_VISIBILITY_TIMEOUT_SECONDS must be between 0 and 43200, got: ${raw}`,
        );
    }
    return value;
}
