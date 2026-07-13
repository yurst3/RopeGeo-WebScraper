/**
 * Reads MAP_DATA_RELEVANCE_PROCESSOR_TIMEOUT_SECONDS and returns the Lambda timeout in milliseconds.
 * @throws Error if the env var is missing or not a positive number
 */
export function getRelevanceProcessorTimeoutMs(): number {
    const timeoutSecondsRaw = process.env.MAP_DATA_RELEVANCE_PROCESSOR_TIMEOUT_SECONDS;
    const timeoutSeconds = timeoutSecondsRaw != null ? parseInt(timeoutSecondsRaw, 10) : NaN;
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
        throw new Error(
            `Invalid MAP_DATA_RELEVANCE_PROCESSOR_TIMEOUT_SECONDS: must be a positive number, got ${JSON.stringify(timeoutSecondsRaw)}`,
        );
    }
    return timeoutSeconds * 1000;
}
