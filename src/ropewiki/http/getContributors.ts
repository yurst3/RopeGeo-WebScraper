import chunk from 'lodash/chunk';
import { httpRequest } from 'ropegeo-common/helpers';

/** MediaWiki allows up to 50 titles per query request. */
const TITLES_PER_REQUEST = 50;

interface MediaWikiContributor {
    userid?: number;
    name: string;
}

interface MediaWikiPage {
    pageid?: number;
    ns?: number;
    title: string;
    missing?: string | boolean;
    contributors?: MediaWikiContributor[];
}

interface MediaWikiQueryResponse {
    batchcomplete?: string;
    continue?: Record<string, string>;
    query?: {
        normalized?: Array<{ from: string; to: string }>;
        pages?: Record<string, MediaWikiPage>;
    };
}

async function fetchContributorsForBatch(
    batchTitles: string[],
    out: Record<string, string[]>,
): Promise<void> {
    let continueParams: Record<string, string> | undefined;

    while (true) {
        const url = new URL('https://ropewiki.com/api.php');
        url.searchParams.set('action', 'query');
        url.searchParams.set('prop', 'contributors');
        url.searchParams.set('titles', batchTitles.join('|'));
        url.searchParams.set('pclimit', 'max');
        url.searchParams.set('format', 'json');
        if (continueParams != null) {
            Object.entries(continueParams).forEach(([key, value]) => {
                url.searchParams.set(key, value);
            });
        }

        const response = await httpRequest(url);
        const body = (await response.json()) as MediaWikiQueryResponse;

        Object.entries(body.query?.pages ?? {}).forEach(([pageKey, page]) => {
            if (pageKey === '-1' || page.pageid === -1 || page.missing !== undefined) {
                return;
            }

            const names = (page.contributors ?? [])
                .map((c) => c.name)
                .filter((name) => typeof name === 'string' && name.length > 0);
            const existing = out[page.title] ?? [];
            names.forEach((name) => {
                if (!existing.includes(name)) {
                    existing.push(name);
                }
            });
            out[page.title] = existing;
        });

        continueParams = body.continue;
        if (continueParams == null) {
            break;
        }
    }
}

/**
 * Fetches MediaWiki contributors for the given wiki titles.
 * Keys in the returned record are response page titles (after MediaWiki normalization).
 * Pages that are missing (pageid -1 / "missing") are omitted.
 */
export async function getContributors(
    titles: string[],
): Promise<Record<string, string[]>> {
    const uniqueTitles = [...new Set(titles.filter((t) => t.trim().length > 0))];
    if (uniqueTitles.length === 0) {
        return {};
    }

    const out: Record<string, string[]> = {};
    const batches = chunk(uniqueTitles, TITLES_PER_REQUEST);

    // Sequential batches: MediaWiki rate limits and continue tokens are per-batch.
    let batchIndex = 0;
    while (batchIndex < batches.length) {
        await fetchContributorsForBatch(batches[batchIndex]!, out);
        batchIndex += 1;
    }

    return out;
}

export default getContributors;
