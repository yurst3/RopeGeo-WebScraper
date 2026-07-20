/**
 * Derive a MediaWiki page title from a Ropewiki page URL path segment.
 * e.g. https://ropewiki.com/Ferriere_(Reunion) → Ferriere_(Reunion)
 */
export function wikiTitleFromPageUrl(pageUrl: string): string {
    const url = new URL(pageUrl);
    const segment = url.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
    if (segment.length === 0) {
        throw new Error(`Could not derive wiki title from page URL: ${pageUrl}`);
    }
    return decodeURIComponent(segment);
}

/**
 * Derive a File: title from a Ropewiki image linkUrl.
 * e.g. https://ropewiki.com/File:Birks_Banner.jpg → File:Birks_Banner.jpg
 */
export function fileTitleFromLinkUrl(linkUrl: string): string | null {
    try {
        const url = new URL(linkUrl);
        const path = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
        if (path.length === 0) return null;
        return path.startsWith('File:') ? path : `File:${path}`;
    } catch {
        return null;
    }
}

/**
 * Normalize a wiki title for case-insensitive underscore/space matching.
 * MediaWiki often returns "File:The Subway.kml" for requests with "File:The_Subway.kml".
 */
export function normalizeWikiTitleKey(title: string): string {
    return decodeURIComponent(title).replace(/_/g, ' ').toLowerCase();
}

/**
 * Look up contributors for a title, allowing underscore/space normalization differences.
 */
export function lookupContributors(
    byTitle: Record<string, string[]>,
    title: string,
): string[] | undefined {
    if (title in byTitle) {
        return byTitle[title];
    }
    const want = normalizeWikiTitleKey(title);
    for (const [key, value] of Object.entries(byTitle)) {
        if (normalizeWikiTitleKey(key) === want) {
            return value;
        }
    }
    return undefined;
}

/**
 * True when the File title refers to a KML map file (handled by map-data, not processPage).
 */
export function isKmlFileTitle(fileTitle: string): boolean {
    return /\.kml$/i.test(fileTitle);
}
