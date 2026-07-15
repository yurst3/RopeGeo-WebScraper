export type MapDataRelevanceReprocessorEventOptions = {
    /**
     * When true, purge MapDataRelevanceProcessingQueue + DLQ and delete all
     * MapDataRelevantContextJob rows before creating fresh jobs. Default false.
     */
    clearMessagesAndJobs?: boolean;
    /**
     * When set, only create/enqueue jobs for these MapData ids.
     * When omitted, all matching MapData-linked Ropewiki pages are processed.
     */
    includeMapDataIds?: string[];
};

/**
 * Options for {@link reprocessMapDataRelevance}: optional queue/job wipe and MapData id filter.
 */
export class MapDataRelevanceReprocessorEvent {
    clearMessagesAndJobs: boolean;
    includeMapDataIds: string[] | undefined;

    constructor(options?: MapDataRelevanceReprocessorEventOptions) {
        this.clearMessagesAndJobs = options?.clearMessagesAndJobs ?? false;
        this.includeMapDataIds = options?.includeMapDataIds;
    }

    static fromParsedBody(parsed: unknown): MapDataRelevanceReprocessorEvent {
        if (parsed === null || parsed === undefined || typeof parsed !== 'object') {
            return new MapDataRelevanceReprocessorEvent();
        }
        const o = parsed as Record<string, unknown>;
        const opts: MapDataRelevanceReprocessorEventOptions = {};

        if ('clearMessagesAndJobs' in o && o.clearMessagesAndJobs !== undefined) {
            if (typeof o.clearMessagesAndJobs !== 'boolean') {
                throw new Error(
                    'Invalid MapDataRelevanceReprocessorEvent: clearMessagesAndJobs must be a boolean when provided',
                );
            }
            opts.clearMessagesAndJobs = o.clearMessagesAndJobs;
        }

        if ('includeMapDataIds' in o && o.includeMapDataIds !== undefined) {
            opts.includeMapDataIds = parseIncludeMapDataIds(o.includeMapDataIds);
        }

        return new MapDataRelevanceReprocessorEvent(opts);
    }

    /**
     * Parses from a Lambda invocation event.
     * - **API Gateway / Function URL:** options live in `event.body` (string or object).
     * - **Direct invoke (e.g. console test):** options are on the root object when any known key is present.
     */
    static fromLambdaEvent(event: unknown): MapDataRelevanceReprocessorEvent {
        if (event === null || event === undefined || typeof event !== 'object') {
            return new MapDataRelevanceReprocessorEvent();
        }
        const e = event as Record<string, unknown>;

        if (e.body != null && e.body !== '') {
            const bodyStr = typeof e.body === 'string' ? e.body : JSON.stringify(e.body);
            if (bodyStr.trim() !== '') {
                let parsed: unknown;
                try {
                    parsed = JSON.parse(bodyStr);
                } catch {
                    throw new Error('Failed to parse MapDataRelevanceReprocessorEvent body as JSON');
                }
                return MapDataRelevanceReprocessorEvent.fromParsedBody(parsed);
            }
        }

        if (
            ('clearMessagesAndJobs' in e && e.clearMessagesAndJobs !== undefined) ||
            ('includeMapDataIds' in e && e.includeMapDataIds !== undefined)
        ) {
            return MapDataRelevanceReprocessorEvent.fromParsedBody(e);
        }

        return new MapDataRelevanceReprocessorEvent();
    }
}

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseIncludeMapDataIds(value: unknown): string[] {
    if (!Array.isArray(value)) {
        throw new Error(
            'Invalid MapDataRelevanceReprocessorEvent: includeMapDataIds must be an array of UUID strings when provided',
        );
    }
    if (value.length === 0) {
        throw new Error(
            'Invalid MapDataRelevanceReprocessorEvent: includeMapDataIds must be a non-empty array when provided',
        );
    }
    const ids: string[] = [];
    for (const item of value) {
        if (typeof item !== 'string' || item.trim() === '') {
            throw new Error(
                'Invalid MapDataRelevanceReprocessorEvent: includeMapDataIds must contain only non-empty UUID strings',
            );
        }
        const id = item.trim();
        if (!UUID_RE.test(id)) {
            throw new Error(
                `Invalid MapDataRelevanceReprocessorEvent: includeMapDataIds contains an invalid UUID: ${id}`,
            );
        }
        ids.push(id);
    }
    return ids;
}

export default MapDataRelevanceReprocessorEvent;
