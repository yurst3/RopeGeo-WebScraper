export type ReprocessRoutesEventOptions = {
    /**
     * When true (default), create a fresh PageZipperJob per page getting routes
     * reprocessed and pass makeDownloadFolder on MapDataEvents (once supported).
     */
    remakeDownloadFolders?: boolean;
};

/**
 * Options for {@link reprocessRoutesHandler}: remake download folders while reprocessing routes.
 */
export class ReprocessRoutesEvent {
    remakeDownloadFolders: boolean;

    constructor(options?: ReprocessRoutesEventOptions) {
        this.remakeDownloadFolders = options?.remakeDownloadFolders ?? true;
    }

    static fromParsedBody(parsed: unknown): ReprocessRoutesEvent {
        if (parsed === null || parsed === undefined || typeof parsed !== 'object') {
            return new ReprocessRoutesEvent();
        }
        const o = parsed as Record<string, unknown>;
        const opts: ReprocessRoutesEventOptions = {};

        if ('remakeDownloadFolders' in o && o.remakeDownloadFolders !== undefined) {
            if (typeof o.remakeDownloadFolders !== 'boolean') {
                throw new Error(
                    'Invalid ReprocessRoutesEvent: remakeDownloadFolders must be a boolean when provided',
                );
            }
            opts.remakeDownloadFolders = o.remakeDownloadFolders;
        }

        return new ReprocessRoutesEvent(opts);
    }

    /**
     * Parses from a Lambda invocation event.
     * - **API Gateway / Function URL:** options live in `event.body` (string or object).
     * - **Direct invoke (e.g. console test):** options are on the root object when any known key is present.
     */
    static fromLambdaEvent(event: unknown): ReprocessRoutesEvent {
        if (event === null || event === undefined || typeof event !== 'object') {
            return new ReprocessRoutesEvent();
        }
        const e = event as Record<string, unknown>;

        if (e.body != null && e.body !== '') {
            const bodyStr = typeof e.body === 'string' ? e.body : JSON.stringify(e.body);
            if (bodyStr.trim() !== '') {
                let parsed: unknown;
                try {
                    parsed = JSON.parse(bodyStr);
                } catch {
                    throw new Error('Failed to parse ReprocessRoutesEvent body as JSON');
                }
                return ReprocessRoutesEvent.fromParsedBody(parsed);
            }
        }

        if ('remakeDownloadFolders' in e && e.remakeDownloadFolders !== undefined) {
            return ReprocessRoutesEvent.fromParsedBody(e);
        }

        return new ReprocessRoutesEvent();
    }
}

export default ReprocessRoutesEvent;
