import type { SqsRecord } from '@aws-lambda-powertools/parser/types';
import { PageDataSource } from 'ropegeo-common';

export class ImageDataEvent {
    pageDataSource: PageDataSource;
    pageImageId: string;
    sourceUrl: string;
    downloadSource: boolean;
    existingProcessedImageId?: string;

    constructor(
        pageDataSource: PageDataSource,
        pageImageId: string,
        sourceUrl: string,
        downloadSource: boolean = true,
        existingProcessedImageId?: string,
    ) {
        ImageDataEvent.validateExistingProcessedImageForDownloadSource(
            downloadSource,
            existingProcessedImageId,
        );
        this.pageDataSource = pageDataSource;
        this.pageImageId = pageImageId;
        this.sourceUrl = sourceUrl;
        this.downloadSource = downloadSource;
        if (existingProcessedImageId !== undefined) {
            this.existingProcessedImageId = existingProcessedImageId;
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
                downloadSource?: boolean;
                existingProcessedImageId?: string;
            };

            const sourceUrl = parsed.sourceUrl ?? parsed.source;
            if (!parsed.pageDataSource || !parsed.pageImageId || !sourceUrl) {
                throw new Error(
                    'Invalid ImageDataEvent: missing required fields (pageDataSource, pageImageId, sourceUrl)',
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

            return new ImageDataEvent(
                parsed.pageDataSource,
                parsed.pageImageId,
                sourceUrl,
                parsed.downloadSource,
                parsed.existingProcessedImageId,
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
