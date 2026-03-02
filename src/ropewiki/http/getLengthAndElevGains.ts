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

const MILES_PER_METER = 0.000621371;
const MILES_PER_KM = 0.621371;
const FEET_PER_METER = 3.28084;
const FEET_PER_MILE = 5280;

/** Parses "6.8", "4miles", "1720m", "-600ft", "0.6 mi" into numeric value and optional unit (lowercase). */
function parseValueAndUnit(str: string): { value: number; unit?: string } | null {
    const trimmed = str.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^(-?[\d.]+)\s*([a-zA-Z]*)\s*$/);
    if (!match) return null;
    const value = parseFloat(match[1]!);
    if (Number.isNaN(value)) return null;
    const rawUnit = match[2]?.toLowerCase();
    const unit = rawUnit && rawUnit !== '' ? rawUnit : undefined;
    return unit !== undefined ? { value, unit } : { value };
}

/** Converts a length to miles. Assumes miles if no unit. */
function lengthToMiles(value: number, unit?: string): number {
    if (!unit || unit === 'mi' || unit === 'miles') return value;
    if (unit === 'm' || unit === 'meter' || unit === 'meters') return value * MILES_PER_METER;
    if (unit === 'km' || unit === 'kilometer' || unit === 'kilometers') return value * MILES_PER_KM;
    if (unit === 'ft' || unit === 'feet') return value / FEET_PER_MILE;
    return value; // unknown unit, treat as miles
}

/** Converts an elevation gain to feet. Assumes feet if no unit. */
function elevToFeet(value: number, unit?: string): number {
    if (!unit || unit === 'ft' || unit === 'feet') return value;
    if (unit === 'm' || unit === 'meter' || unit === 'meters') return value * FEET_PER_METER;
    return value; // unknown unit, treat as feet
}

const LENGTH_KEYS: (keyof LengthAndElevGain)[] = ['overallLength', 'approachLength', 'descentLength', 'exitLength'];
const ELEV_KEYS: (keyof LengthAndElevGain)[] = ['approachElevGain', 'descentElevGain', 'exitElevGain'];

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
 * All lengths are converted to miles; all elevation gains to feet.
 * Matches lines like |Hike length=6.8 or |Approach length=1720m
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
            const parsed = parseValueAndUnit(match[1]!);
            if (parsed !== null) {
                const isLength = LENGTH_KEYS.includes(key);
                result[key] = isLength
                    ? lengthToMiles(parsed.value, parsed.unit)
                    : elevToFeet(parsed.value, parsed.unit);
            }
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
