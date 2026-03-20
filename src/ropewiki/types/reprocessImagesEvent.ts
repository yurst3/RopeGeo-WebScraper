export type ReprocessImagesEventOptions = {
    downloadSource?: boolean;
    onlyUnprocessed?: boolean;
};

/**
 * Options for {@link reprocessImagesHandler}: queue image jobs with optional download vs lossless,
 * and optionally restrict to rows with no processedImage yet.
 */
export class ReprocessImagesEvent {
    downloadSource: boolean;
    onlyUnprocessed: boolean;

    constructor(options?: ReprocessImagesEventOptions) {
        this.downloadSource = options?.downloadSource ?? true;
        this.onlyUnprocessed = options?.onlyUnprocessed ?? true;
        if (!this.downloadSource && this.onlyUnprocessed) {
            throw new Error(
                'Invalid ReprocessImagesEvent: onlyUnprocessed cannot be true when downloadSource is false',
            );
        }
    }

    static fromParsedBody(parsed: unknown): ReprocessImagesEvent {
        if (parsed === null || parsed === undefined || typeof parsed !== 'object') {
            return new ReprocessImagesEvent();
        }
        const o = parsed as Record<string, unknown>;
        let downloadSource: boolean | undefined;
        let onlyUnprocessed: boolean | undefined;
        if ('downloadSource' in o) {
            if (typeof o.downloadSource !== 'boolean') {
                throw new Error(
                    'Invalid ReprocessImagesEvent: downloadSource must be a boolean when provided',
                );
            }
            downloadSource = o.downloadSource;
        }
        if ('onlyUnprocessed' in o) {
            if (typeof o.onlyUnprocessed !== 'boolean') {
                throw new Error(
                    'Invalid ReprocessImagesEvent: onlyUnprocessed must be a boolean when provided',
                );
            }
            onlyUnprocessed = o.onlyUnprocessed;
        }
        const opts: ReprocessImagesEventOptions = {};
        if (downloadSource !== undefined) {
            opts.downloadSource = downloadSource;
        }
        if (onlyUnprocessed !== undefined) {
            opts.onlyUnprocessed = onlyUnprocessed;
        }
        return new ReprocessImagesEvent(opts);
    }

    /**
     * Parses from a Lambda invocation event (e.g. API Gateway with JSON body). Missing or empty body uses defaults.
     */
    static fromLambdaEvent(event: unknown): ReprocessImagesEvent {
        if (event === null || event === undefined || typeof event !== 'object') {
            return new ReprocessImagesEvent();
        }
        const e = event as { body?: unknown };
        if (e.body === undefined || e.body === null) {
            return new ReprocessImagesEvent();
        }
        const bodyStr = typeof e.body === 'string' ? e.body : JSON.stringify(e.body);
        if (bodyStr.trim() === '') {
            return new ReprocessImagesEvent();
        }
        let parsed: unknown;
        try {
            parsed = JSON.parse(bodyStr);
        } catch {
            throw new Error('Failed to parse ReprocessImagesEvent body as JSON');
        }
        return ReprocessImagesEvent.fromParsedBody(parsed);
    }
}

export default ReprocessImagesEvent;
