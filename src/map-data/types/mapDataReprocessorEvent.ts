export type MapDataReprocessorEventOptions = {
    /** If false (default), only rows with stored KML or GPX are enqueued; processing uses S3 source. If true, all linked MapData rows are enqueued and sources are re-downloaded from URLs. */
    downloadSource?: boolean;
    /** If true, enqueued MapDataEvent jobs run outlier-point cleaning before enrich/upload. Default false. */
    cleanOutlierPoints?: boolean;
    /**
     * When true (default), enqueued MapDataEvent jobs upsert/enqueue MapDataRelevantContextJob after map processing.
     * When false, that step is skipped.
     */
    processRelevantContext?: boolean;
    /**
     * When set, only enqueue these MapData ids (still subject to downloadSource / stored-source filter).
     * When omitted, all matching MapData-linked Ropewiki routes are enqueued.
     */
    includeMapDataIds?: string[];
};

/**
 * Options for {@link reprocessMapData}: controls whether map-data jobs use stored S3 sources
 * or re-download from {@link MapData.sourceFileUrl}, optional outlier cleaning, relevance gating,
 * and optional id filter.
 */
export class MapDataReprocessorEvent {
    downloadSource: boolean;
    cleanOutlierPoints: boolean;
    processRelevantContext: boolean;
    includeMapDataIds: string[] | undefined;

    constructor(options?: MapDataReprocessorEventOptions) {
        this.downloadSource = options?.downloadSource ?? false;
        this.cleanOutlierPoints = options?.cleanOutlierPoints ?? false;
        this.processRelevantContext = options?.processRelevantContext ?? true;
        this.includeMapDataIds = options?.includeMapDataIds;
    }

    static fromParsedBody(parsed: unknown): MapDataReprocessorEvent {
        if (parsed === null || parsed === undefined || typeof parsed !== 'object') {
            return new MapDataReprocessorEvent();
        }
        const o = parsed as Record<string, unknown>;
        const opts: MapDataReprocessorEventOptions = {};

        if ('downloadSource' in o && o.downloadSource !== undefined) {
            if (typeof o.downloadSource !== 'boolean') {
                throw new Error(
                    'Invalid MapDataReprocessorEvent: downloadSource must be a boolean when provided',
                );
            }
            opts.downloadSource = o.downloadSource;
        }

        if ('cleanOutlierPoints' in o && o.cleanOutlierPoints !== undefined) {
            if (typeof o.cleanOutlierPoints !== 'boolean') {
                throw new Error(
                    'Invalid MapDataReprocessorEvent: cleanOutlierPoints must be a boolean when provided',
                );
            }
            opts.cleanOutlierPoints = o.cleanOutlierPoints;
        }

        if ('processRelevantContext' in o && o.processRelevantContext !== undefined) {
            if (typeof o.processRelevantContext !== 'boolean') {
                throw new Error(
                    'Invalid MapDataReprocessorEvent: processRelevantContext must be a boolean when provided',
                );
            }
            opts.processRelevantContext = o.processRelevantContext;
        }

        if ('includeMapDataIds' in o && o.includeMapDataIds !== undefined) {
            opts.includeMapDataIds = parseIncludeMapDataIds(o.includeMapDataIds);
        }

        return new MapDataReprocessorEvent(opts);
    }

    /**
     * Parses from a Lambda invocation event.
     * - **API Gateway / Function URL:** options live in `event.body` (string or object).
     * - **Direct invoke (e.g. console test):** options are on the root object when any known key is present.
     */
    static fromLambdaEvent(event: unknown): MapDataReprocessorEvent {
        if (event === null || event === undefined || typeof event !== 'object') {
            return new MapDataReprocessorEvent();
        }
        const e = event as Record<string, unknown>;

        if (e.body != null && e.body !== '') {
            const bodyStr = typeof e.body === 'string' ? e.body : JSON.stringify(e.body);
            if (bodyStr.trim() !== '') {
                let parsed: unknown;
                try {
                    parsed = JSON.parse(bodyStr);
                } catch {
                    throw new Error('Failed to parse MapDataReprocessorEvent body as JSON');
                }
                return MapDataReprocessorEvent.fromParsedBody(parsed);
            }
        }

        if (
            ('downloadSource' in e && e.downloadSource !== undefined) ||
            ('cleanOutlierPoints' in e && e.cleanOutlierPoints !== undefined) ||
            ('processRelevantContext' in e && e.processRelevantContext !== undefined) ||
            ('includeMapDataIds' in e && e.includeMapDataIds !== undefined)
        ) {
            return MapDataReprocessorEvent.fromParsedBody(e);
        }

        return new MapDataReprocessorEvent();
    }
}

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseIncludeMapDataIds(value: unknown): string[] {
    if (!Array.isArray(value)) {
        throw new Error(
            'Invalid MapDataReprocessorEvent: includeMapDataIds must be an array of UUID strings when provided',
        );
    }
    if (value.length === 0) {
        throw new Error(
            'Invalid MapDataReprocessorEvent: includeMapDataIds must be a non-empty array when provided',
        );
    }
    const ids: string[] = [];
    for (const item of value) {
        if (typeof item !== 'string' || item.trim() === '') {
            throw new Error(
                'Invalid MapDataReprocessorEvent: includeMapDataIds must contain only non-empty UUID strings',
            );
        }
        const id = item.trim();
        if (!UUID_RE.test(id)) {
            throw new Error(
                `Invalid MapDataReprocessorEvent: includeMapDataIds contains an invalid UUID: ${id}`,
            );
        }
        ids.push(id);
    }
    return ids;
}

export default MapDataReprocessorEvent;
