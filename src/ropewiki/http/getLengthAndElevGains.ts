import chunk from 'lodash/chunk';
import httpRequest from '../../helpers/httpRequest';

export interface LengthAndElevGain {
    overallLength: number | null;
    approachLength: number | null;
    approachElevGain: number | null;
    descentLength: number | null;
    descentElevGain: number | null;
    exitLength: number | null;
    exitElevGain: number | null;
}

/** Parses a string to a number; returns null if not parseable. Handles values like "6.8", "4miles", "-600ft". */
function parseNumericValue(str: string): number | null {
    const trimmed = str.trim();
    if (!trimmed) return null;
    const n = parseFloat(trimmed);
    return Number.isNaN(n) ? null : n;
}

/** Property label in wiki template -> our key */
const WIKI_PROPERTIES: Array<{ wikiLabel: string; key: keyof LengthAndElevGain }> = [
    { wikiLabel: 'Hike length', key: 'overallLength' },
    { wikiLabel: 'Approach length', key: 'approachLength' },
    { wikiLabel: 'Approach elevation gain', key: 'approachElevGain' },
    { wikiLabel: 'Length', key: 'descentLength' },
    { wikiLabel: 'Depth', key: 'descentElevGain' },
    { wikiLabel: 'Exit length', key: 'exitLength' },
    { wikiLabel: 'Exit elevation gain', key: 'exitElevGain' },
];

/**
 * Parses raw wiki template text for length/elevation properties.
 * Matches lines like |Hike length=6.8 or |Approach length=4miles
 */
function parseLengthAndElevGainFromWikitext(wikitext: string): LengthAndElevGain {
    const result: LengthAndElevGain = {
        overallLength: null,
        approachLength: null,
        approachElevGain: null,
        descentLength: null,
        descentElevGain: null,
        exitLength: null,
        exitElevGain: null,
    };

    for (const { wikiLabel, key } of WIKI_PROPERTIES) {
        const escaped = wikiLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`\\|${escaped}=([^\\n|]*)`, 'i');
        const match = wikitext.match(re);
        if (match) {
            const parsed = parseNumericValue(match[1]!);
            if (parsed !== null) result[key] = parsed;
        }
    }

    return result;
}

interface MediaWikiPage {
    pageid?: number;
    revisions?: Array<
        | { '*': string }
        | { slots?: { main?: { '*': string } } }
    >;
    missing?: boolean;
    invalid?: boolean;
}

interface MediaWikiQueryResponse {
    query?: { pages?: Record<string, MediaWikiPage> };
}

// Maximum number of pageids per request; see https://www.mediawiki.org/wiki/API:Query#Specifying_pages
const PAGEIDS_PER_REQUEST = 50;

/**
 * Fetches raw wikitext for the given Ropewiki pageids from the MediaWiki API,
 * then parses length and elevation gain properties from the Canyon template.
 * Sends requests in sequential batches of PAGEIDS_PER_REQUEST to respect the API limit.
 * Returns a map of pageid (string) to LengthAndElevGain; pages that are missing,
 * invalid, or have no revisions are omitted or have empty stats.
 */
const getLengthAndElevGains = async (
    pageids: string[],
): Promise<Record<string, LengthAndElevGain>> => {
    if (pageids.length === 0) {
        return {};
    }

    const out: Record<string, LengthAndElevGain> = {};
    const batches = chunk(pageids, PAGEIDS_PER_REQUEST);

    for (const batch of batches) {
        const pageidParam = batch.join('|');
        const url = new URL('https://ropewiki.com/api.php');
        url.searchParams.set('action', 'query');
        url.searchParams.set('prop', 'revisions');
        url.searchParams.set('pageids', pageidParam);
        url.searchParams.set('rvprop', 'content');
        url.searchParams.set('rvslots', '*');
        url.searchParams.set('format', 'json');

        const response = await httpRequest(url);
        const body = (await response.json()) as MediaWikiQueryResponse;
        const pages = body.query?.pages ?? {};

        for (const pageid of Object.keys(pages)) {
            const page = pages[pageid];
            if (!page || page.missing || page.invalid || !page.revisions?.length) {
                continue;
            }
            const rev = page.revisions[0]!;
            const raw =
                (rev as { slots?: { main?: { '*': string } } }).slots?.main?.['*'] ??
                (rev as { '*': string })['*'];
            if (typeof raw !== 'string') {
                continue;
            }
            out[pageid] = parseLengthAndElevGainFromWikitext(raw);
        }
    }

    return out;
};

export default getLengthAndElevGains;
