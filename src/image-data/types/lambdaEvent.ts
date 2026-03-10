import type { SqsRecord } from '@aws-lambda-powertools/parser/types';
import { PageDataSource } from 'ropegeo-common';

export class ImageDataEvent {
    pageDataSource: PageDataSource;
    id: string;
    source: string;

    constructor(pageDataSource: PageDataSource, id: string, source: string) {
        this.pageDataSource = pageDataSource;
        this.id = id;
        this.source = source;
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
                id?: string;
                source?: string;
            };

            if (!parsed.pageDataSource || !parsed.id || !parsed.source) {
                throw new Error(
                    'Invalid ImageDataEvent: missing required fields (pageDataSource, id, source)',
                );
            }

            if (!Object.values(PageDataSource).includes(parsed.pageDataSource)) {
                throw new Error(
                    `Invalid ImageDataEvent: pageDataSource must be one of ${Object.values(PageDataSource).join(', ')}, got: ${parsed.pageDataSource}`,
                );
            }

            return new ImageDataEvent(parsed.pageDataSource, parsed.id, parsed.source);
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error(`Failed to parse SQS record body as JSON: ${error.message}`);
            }
            throw error;
        }
    }
}

export default ImageDataEvent;
