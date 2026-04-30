export type MapDataReprocessorEventOptions = {
    /** If false (default), only rows with stored KML or GPX are enqueued; processing uses S3 source. If true, all linked MapData rows are enqueued and sources are re-downloaded from URLs. */
    downloadSource?: boolean;
};

/**
 * Options for {@link reprocessMapData}: controls whether map-data jobs use stored S3 sources
 * or re-download from {@link MapData.sourceFileUrl}.
 */
export class MapDataReprocessorEvent {
    downloadSource: boolean;

    constructor(options?: MapDataReprocessorEventOptions) {
        this.downloadSource = options?.downloadSource ?? false;
    }

    static fromParsedBody(parsed: unknown): MapDataReprocessorEvent {
        if (parsed === null || parsed === undefined || typeof parsed !== 'object') {
            return new MapDataReprocessorEvent();
        }
        const o = parsed as Record<string, unknown>;
        if (!('downloadSource' in o) || o.downloadSource === undefined) {
            return new MapDataReprocessorEvent();
        }
        if (typeof o.downloadSource !== 'boolean') {
            throw new Error('Invalid MapDataReprocessorEvent: downloadSource must be a boolean when provided');
        }
        return new MapDataReprocessorEvent({ downloadSource: o.downloadSource });
    }

    /**
     * Parses from a Lambda invocation event.
     * - **API Gateway / Function URL:** options live in `event.body` (string or object).
     * - **Direct invoke (e.g. console test):** options are on the root object when `downloadSource` is present.
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

        if ('downloadSource' in e && e.downloadSource !== undefined) {
            return MapDataReprocessorEvent.fromParsedBody(e);
        }

        return new MapDataReprocessorEvent();
    }
}

export default MapDataReprocessorEvent;
