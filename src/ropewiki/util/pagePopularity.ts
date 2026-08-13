type PopularityFields = {
    quality?: number | null | undefined;
    userVotes?: number | null | undefined;
};

/**
 * Popularity used to pick a canonical route name among pages that share coordinates:
 * quality × userVotes (missing values treated as 0).
 */
export function pagePopularity(page: PopularityFields): number {
    return (page.quality ?? 0) * (page.userVotes ?? 0);
}

/**
 * Returns the most popular page. On ties, keeps the earlier page in the input array.
 */
export function pickMostPopularPage<T extends PopularityFields>(pages: T[]): T {
    if (pages.length === 0) {
        throw new Error('pickMostPopularPage requires at least one page');
    }

    let best = pages[0]!;
    let bestScore = pagePopularity(best);

    for (let i = 1; i < pages.length; i++) {
        const candidate = pages[i]!;
        const score = pagePopularity(candidate);
        if (score > bestScore) {
            best = candidate;
            bestScore = score;
        }
    }

    return best;
}

/** Stable string key for exact lat/lon matching when grouping routes. */
export function coordinatesKey(coordinates: { lat: number; lon: number }): string {
    return `${coordinates.lat},${coordinates.lon}`;
}
