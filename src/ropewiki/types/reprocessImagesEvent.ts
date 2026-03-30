import type { ImageVersion } from 'ropegeo-common';
import { assertValidImageVersions } from '../../image-data/util/imageVersionFile';

export type ReprocessImagesEventOptions = {
    downloadSource?: boolean;
    onlyUnprocessed?: boolean;
    versions?: ImageVersion[];
};

/**
 * Options for {@link reprocessImagesHandler}: queue image jobs with optional version subset,
 * `onlyUnprocessed` to limit to never-processed rows, and `downloadSource` to choose wiki download
 * vs existing `ImageData` (see `getRopewikiImagesToProcess`).
 */
export class ReprocessImagesEvent {
    downloadSource: boolean;
    onlyUnprocessed: boolean;
    versions?: ImageVersion[];

    constructor(options?: ReprocessImagesEventOptions) {
        this.downloadSource = options?.downloadSource ?? true;
        this.onlyUnprocessed = options?.onlyUnprocessed ?? true;
        if (!this.downloadSource && this.onlyUnprocessed) {
            throw new Error(
                'Invalid ReprocessImagesEvent: onlyUnprocessed cannot be true when downloadSource is false',
            );
        }
        if (options?.versions !== undefined) {
            if (!assertValidImageVersions(options.versions) || options.versions.length === 0) {
                throw new Error(
                    'Invalid ReprocessImagesEvent: versions must be a non-empty array of ImageVersion strings',
                );
            }
            this.versions = [...options.versions];
        }
    }

    static fromParsedBody(parsed: unknown): ReprocessImagesEvent {
        if (parsed === null || parsed === undefined || typeof parsed !== 'object') {
            return new ReprocessImagesEvent();
        }
        const o = parsed as Record<string, unknown>;
        let downloadSource: boolean | undefined;
        let onlyUnprocessed: boolean | undefined;
        let versions: ImageVersion[] | undefined;
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
        if ('versions' in o && o.versions !== undefined) {
            if (!assertValidImageVersions(o.versions) || o.versions.length === 0) {
                throw new Error(
                    'Invalid ReprocessImagesEvent: versions must be a non-empty array of ImageVersion strings',
                );
            }
            versions = o.versions;
        }
        const opts: ReprocessImagesEventOptions = {};
        if (downloadSource !== undefined) {
            opts.downloadSource = downloadSource;
        }
        if (onlyUnprocessed !== undefined) {
            opts.onlyUnprocessed = onlyUnprocessed;
        }
        if (versions !== undefined) {
            opts.versions = versions;
        }
        return new ReprocessImagesEvent(opts);
    }

    /**
     * Parses from a Lambda invocation event.
     * - **API Gateway / Function URL:** options live in `event.body` (string or object).
     * - **Direct invoke (e.g. console test):** options are on the root object; there is no `body` key.
     */
    static fromLambdaEvent(event: unknown): ReprocessImagesEvent {
        if (event === null || event === undefined || typeof event !== 'object') {
            return new ReprocessImagesEvent();
        }
        const e = event as Record<string, unknown>;

        if (e.body != null && e.body !== '') {
            const bodyStr = typeof e.body === 'string' ? e.body : JSON.stringify(e.body);
            if (bodyStr.trim() !== '') {
                let parsed: unknown;
                try {
                    parsed = JSON.parse(bodyStr);
                } catch {
                    throw new Error('Failed to parse ReprocessImagesEvent body as JSON');
                }
                return ReprocessImagesEvent.fromParsedBody(parsed);
            }
        }

        if (ReprocessImagesEvent.isRootReprocessPayload(e)) {
            return ReprocessImagesEvent.fromParsedBody(e);
        }

        return new ReprocessImagesEvent();
    }

    /** True when the Lambda root looks like a direct ReprocessImagesEvent JSON (console / SDK invoke). */
    private static isRootReprocessPayload(o: Record<string, unknown>): boolean {
        return (
            ('downloadSource' in o && o.downloadSource !== undefined) ||
            ('onlyUnprocessed' in o && o.onlyUnprocessed !== undefined) ||
            ('versions' in o && o.versions !== undefined)
        );
    }
}

export default ReprocessImagesEvent;
