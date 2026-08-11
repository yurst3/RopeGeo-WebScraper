import type { SqsRecord } from '@aws-lambda-powertools/parser/types';
import { ImageVersion, PageDataSource } from 'ropegeo-common/models';
import { assertValidImageVersions, ALL_IMAGE_VERSIONS } from '../util/imageVersionFile';

export class ImageDataEvent {
    pageDataSource: PageDataSource;
    pageImageId: string;
    sourceUrl: string;
    pageId: string;
    downloadSource: boolean;
    existingProcessedImageId?: string;
    /** When set, only these variants are encoded and uploaded; when omitted, all versions run. */
    versions?: ImageVersion[];
    makeDownloadFolder: boolean;

    constructor(
        pageDataSource: PageDataSource,
        pageImageId: string,
        sourceUrl: string,
        pageId: string,
        downloadSource: boolean = true,
        existingProcessedImageId?: string,
        versions?: ImageVersion[],
        makeDownloadFolder: boolean = true,
    ) {
        ImageDataEvent.validateExistingProcessedImageForDownloadSource(
            downloadSource,
            existingProcessedImageId,
        );
        if (typeof pageId !== 'string' || pageId.trim() === '') {
            throw new Error('Invalid ImageDataEvent: pageId must be a non-empty string');
        }
        this.pageDataSource = pageDataSource;
        this.pageImageId = pageImageId;
        this.sourceUrl = sourceUrl;
        this.pageId = pageId;
        this.downloadSource = downloadSource;
        if (existingProcessedImageId !== undefined) {
            this.existingProcessedImageId = existingProcessedImageId;
        }
        if (versions !== undefined) {
            ImageDataEvent.validateVersions(versions);
            this.versions = [...versions];
        }
        this.makeDownloadFolder = makeDownloadFolder;
    }

    private static validateVersions(versions: ImageVersion[]): void {
        if (versions.length === 0) {
            throw new Error('Invalid ImageDataEvent: versions, when provided, must be non-empty');
        }
        const allowed = new Set(ALL_IMAGE_VERSIONS);
        for (const v of versions) {
            if (!allowed.has(v)) {
                throw new Error(`Invalid ImageDataEvent: unknown version "${String(v)}"`);
            }
        }
    }

    private static validateExistingProcessedImageForDownloadSource(
        downloadSource: boolean,
        existingProcessedImageId: string | undefined,
    ): void {
        if (downloadSource) {
            if (existingProcessedImageId !== undefined) {
                if (typeof existingProcessedImageId !== 'string') {
                    throw new Error(
                        'Invalid ImageDataEvent: existingProcessedImageId must be a string when provided',
                    );
                }
                if (existingProcessedImageId.trim() === '') {
                    throw new Error(
                        'Invalid ImageDataEvent: existingProcessedImageId must not be empty when provided',
                    );
                }
            }
            return;
        }
        if (
            existingProcessedImageId === undefined
            || typeof existingProcessedImageId !== 'string'
            || existingProcessedImageId.trim() === ''
        ) {
            throw new Error(
                'Invalid ImageDataEvent: existingProcessedImageId is required when downloadSource is false',
            );
        }
    }

    /**
     * Parses an ImageDataEvent from an SQS record body.
     */
    static fromSQSEventRecord(record: SqsRecord): ImageDataEvent {
        if (!record.body) {
            throw new Error('SQS record missing body');
        }

        try {
            const parsed = JSON.parse(record.body) as {
                pageDataSource?: PageDataSource;
                pageImageId?: string;
                sourceUrl?: string;
                /** @deprecated Prefer sourceUrl; accepted for older queue messages */
                source?: string;
                pageId?: string;
                downloadSource?: boolean;
                existingProcessedImageId?: string;
                versions?: unknown;
                makeDownloadFolder?: boolean | null;
            };

            const sourceUrl = parsed.sourceUrl ?? parsed.source;
            if (!parsed.pageDataSource || !parsed.pageImageId || !sourceUrl || !parsed.pageId) {
                throw new Error(
                    'Invalid ImageDataEvent: missing required fields (pageDataSource, pageImageId, sourceUrl, pageId)',
                );
            }

            if (typeof parsed.downloadSource !== 'boolean') {
                throw new Error('Invalid ImageDataEvent: downloadSource must be present and a boolean');
            }

            if (!Object.values(PageDataSource).includes(parsed.pageDataSource)) {
                throw new Error(
                    `Invalid ImageDataEvent: pageDataSource must be one of ${Object.values(PageDataSource).join(', ')}, got: ${parsed.pageDataSource}`,
                );
            }

            if (
                parsed.makeDownloadFolder != null &&
                typeof parsed.makeDownloadFolder !== 'boolean'
            ) {
                throw new Error(
                    'Invalid ImageDataEvent: makeDownloadFolder must be a boolean when provided',
                );
            }

            let versions: ImageVersion[] | undefined;
            if (parsed.versions !== undefined) {
                if (!assertValidImageVersions(parsed.versions)) {
                    throw new Error(
                        'Invalid ImageDataEvent: versions must be an array of ImageVersion strings',
                    );
                }
                versions = parsed.versions;
            }

            return new ImageDataEvent(
                parsed.pageDataSource,
                parsed.pageImageId,
                sourceUrl,
                parsed.pageId,
                parsed.downloadSource,
                parsed.existingProcessedImageId,
                versions,
                parsed.makeDownloadFolder ?? true,
            );
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error(`Failed to parse SQS record body as JSON: ${error.message}`);
            }
            throw error;
        }
    }
}

export default ImageDataEvent;
