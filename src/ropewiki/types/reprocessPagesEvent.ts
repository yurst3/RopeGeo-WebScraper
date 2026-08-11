export type ReprocessPagesEventOptions = {
    /**
     * When true (default), create a fresh PageZipperJob per page and pass
     * makeDownloadFolder on page-processor messages (once supported).
     */
    remakeDownloadFolders?: boolean;
    /**
     * When set, only enqueue these RopewikiPage ids.
     * When omitted, all non-deleted pages are enqueued.
     */
    includePageIds?: string[];
};

/**
 * Options for {@link reprocessPagesHandler}: remake download folders and optional page id filter.
 */
export class ReprocessPagesEvent {
    remakeDownloadFolders: boolean;
    includePageIds: string[] | undefined;

    constructor(options?: ReprocessPagesEventOptions) {
        this.remakeDownloadFolders = options?.remakeDownloadFolders ?? true;
        this.includePageIds = options?.includePageIds;
    }

    static fromParsedBody(parsed: unknown): ReprocessPagesEvent {
        if (parsed === null || parsed === undefined || typeof parsed !== 'object') {
            return new ReprocessPagesEvent();
        }
        const o = parsed as Record<string, unknown>;
        const opts: ReprocessPagesEventOptions = {};

        if ('remakeDownloadFolders' in o && o.remakeDownloadFolders !== undefined) {
            if (typeof o.remakeDownloadFolders !== 'boolean') {
                throw new Error(
                    'Invalid ReprocessPagesEvent: remakeDownloadFolders must be a boolean when provided',
                );
            }
            opts.remakeDownloadFolders = o.remakeDownloadFolders;
        }

        if ('includePageIds' in o && o.includePageIds !== undefined) {
            opts.includePageIds = parseIncludePageIds(o.includePageIds);
        }

        return new ReprocessPagesEvent(opts);
    }

    /**
     * Parses from a Lambda invocation event.
     * - **API Gateway / Function URL:** options live in `event.body` (string or object).
     * - **Direct invoke (e.g. console test):** options are on the root object when any known key is present.
     */
    static fromLambdaEvent(event: unknown): ReprocessPagesEvent {
        if (event === null || event === undefined || typeof event !== 'object') {
            return new ReprocessPagesEvent();
        }
        const e = event as Record<string, unknown>;

        if (e.body != null && e.body !== '') {
            const bodyStr = typeof e.body === 'string' ? e.body : JSON.stringify(e.body);
            if (bodyStr.trim() !== '') {
                let parsed: unknown;
                try {
                    parsed = JSON.parse(bodyStr);
                } catch {
                    throw new Error('Failed to parse ReprocessPagesEvent body as JSON');
                }
                return ReprocessPagesEvent.fromParsedBody(parsed);
            }
        }

        if (
            ('remakeDownloadFolders' in e && e.remakeDownloadFolders !== undefined) ||
            ('includePageIds' in e && e.includePageIds !== undefined)
        ) {
            return ReprocessPagesEvent.fromParsedBody(e);
        }

        return new ReprocessPagesEvent();
    }
}

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseIncludePageIds(value: unknown): string[] {
    if (!Array.isArray(value)) {
        throw new Error(
            'Invalid ReprocessPagesEvent: includePageIds must be an array of UUID strings when provided',
        );
    }
    if (value.length === 0) {
        throw new Error(
            'Invalid ReprocessPagesEvent: includePageIds must be a non-empty array when provided',
        );
    }
    const ids: string[] = [];
    for (const item of value) {
        if (typeof item !== 'string' || item.trim() === '') {
            throw new Error(
                'Invalid ReprocessPagesEvent: includePageIds must contain only non-empty UUID strings',
            );
        }
        const id = item.trim();
        if (!UUID_RE.test(id)) {
            throw new Error(
                `Invalid ReprocessPagesEvent: includePageIds contains an invalid UUID: ${id}`,
            );
        }
        ids.push(id);
    }
    return ids;
}

export default ReprocessPagesEvent;
