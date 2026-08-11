export type PageZipReprocessorEventOptions = {
    /**
     * When true, purge PageZipperQueue + DLQ and delete all PageZipperJob rows
     * before creating fresh jobs. Default false.
     */
    clearMessagesAndJobs?: boolean;
    /**
     * When set, only create/enqueue jobs for these page ids.
     * When omitted, all pages needing a download folder are processed.
     */
    includePageIds?: string[];
};

/**
 * Options for {@link reprocessPageZipper}: optional queue/job wipe and page id filter.
 */
export class PageZipReprocessorEvent {
    clearMessagesAndJobs: boolean;
    includePageIds: string[] | undefined;

    constructor(options?: PageZipReprocessorEventOptions) {
        this.clearMessagesAndJobs = options?.clearMessagesAndJobs ?? false;
        this.includePageIds = options?.includePageIds;
    }

    static fromParsedBody(parsed: unknown): PageZipReprocessorEvent {
        if (parsed === null || parsed === undefined || typeof parsed !== 'object') {
            return new PageZipReprocessorEvent();
        }
        const o = parsed as Record<string, unknown>;
        const opts: PageZipReprocessorEventOptions = {};

        if ('clearMessagesAndJobs' in o && o.clearMessagesAndJobs !== undefined) {
            if (typeof o.clearMessagesAndJobs !== 'boolean') {
                throw new Error(
                    'Invalid PageZipReprocessorEvent: clearMessagesAndJobs must be a boolean when provided',
                );
            }
            opts.clearMessagesAndJobs = o.clearMessagesAndJobs;
        }

        if ('includePageIds' in o && o.includePageIds !== undefined) {
            opts.includePageIds = parseIncludePageIds(o.includePageIds);
        }

        return new PageZipReprocessorEvent(opts);
    }

    /**
     * Parses from a Lambda invocation event.
     * - **API Gateway / Function URL:** options live in `event.body` (string or object).
     * - **Direct invoke (e.g. console test):** options are on the root object when any known key is present.
     */
    static fromLambdaEvent(event: unknown): PageZipReprocessorEvent {
        if (event === null || event === undefined || typeof event !== 'object') {
            return new PageZipReprocessorEvent();
        }
        const e = event as Record<string, unknown>;

        if (e.body != null && e.body !== '') {
            const bodyStr = typeof e.body === 'string' ? e.body : JSON.stringify(e.body);
            if (bodyStr.trim() !== '') {
                let parsed: unknown;
                try {
                    parsed = JSON.parse(bodyStr);
                } catch {
                    throw new Error('Failed to parse PageZipReprocessorEvent body as JSON');
                }
                return PageZipReprocessorEvent.fromParsedBody(parsed);
            }
        }

        if (
            ('clearMessagesAndJobs' in e && e.clearMessagesAndJobs !== undefined) ||
            ('includePageIds' in e && e.includePageIds !== undefined)
        ) {
            return PageZipReprocessorEvent.fromParsedBody(e);
        }

        return new PageZipReprocessorEvent();
    }
}

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseIncludePageIds(value: unknown): string[] {
    if (!Array.isArray(value)) {
        throw new Error(
            'Invalid PageZipReprocessorEvent: includePageIds must be an array of UUID strings when provided',
        );
    }
    if (value.length === 0) {
        throw new Error(
            'Invalid PageZipReprocessorEvent: includePageIds must be a non-empty array when provided',
        );
    }
    const ids: string[] = [];
    for (const item of value) {
        if (typeof item !== 'string' || item.trim() === '') {
            throw new Error(
                'Invalid PageZipReprocessorEvent: includePageIds must contain only non-empty UUID strings',
            );
        }
        const id = item.trim();
        if (!UUID_RE.test(id)) {
            throw new Error(
                `Invalid PageZipReprocessorEvent: includePageIds contains an invalid UUID: ${id}`,
            );
        }
        ids.push(id);
    }
    return ids;
}

export default PageZipReprocessorEvent;
