/**
 * Max attempts per legend item for runLegendContextModel (including the first try).
 * Reads MAP_DATA_RELEVANCE_MODEL_MAX_ATTEMPTS (integer >= 1).
 */
export function getRelevanceModelMaxAttempts(): number {
    const raw = process.env.MAP_DATA_RELEVANCE_MODEL_MAX_ATTEMPTS;
    if (raw === undefined || raw === '') {
        throw new Error('MAP_DATA_RELEVANCE_MODEL_MAX_ATTEMPTS environment variable is not set');
    }
    const value = parseInt(raw, 10);
    if (Number.isNaN(value) || value < 1) {
        throw new Error(
            `MAP_DATA_RELEVANCE_MODEL_MAX_ATTEMPTS must be an integer >= 1, got: ${raw}`,
        );
    }
    return value;
}
