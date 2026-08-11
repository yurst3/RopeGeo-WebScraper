import type { SqsRecord } from '@aws-lambda-powertools/parser/types';
import { PageDataSource } from 'ropegeo-common/models';

export class PageZipperJobEvent {
    readonly id: string;
    readonly pageId: string;
    readonly pageSource: PageDataSource;

    constructor(id: string, pageId: string, pageSource: PageDataSource) {
        this.id = id;
        this.pageId = pageId;
        this.pageSource = pageSource;
    }

    static fromSQSEventRecord(record: SqsRecord): PageZipperJobEvent {
        if (!record.body) {
            throw new Error('SQS record missing body');
        }

        try {
            const parsed = JSON.parse(record.body) as {
                id?: string;
                pageId?: string;
                pageSource?: PageDataSource;
            };

            if (!parsed.id || !parsed.pageId || !parsed.pageSource) {
                throw new Error(
                    'Invalid PageZipperJobEvent: missing required fields (id, pageId, pageSource)',
                );
            }

            if (!Object.values(PageDataSource).includes(parsed.pageSource)) {
                throw new Error(
                    `Invalid PageZipperJobEvent: pageSource must be one of ${Object.values(PageDataSource).join(', ')}, got: ${parsed.pageSource}`,
                );
            }

            return new PageZipperJobEvent(parsed.id, parsed.pageId, parsed.pageSource);
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error(`Failed to parse SQS record body as JSON: ${error.message}`);
            }
            throw error;
        }
    }
}

export default PageZipperJobEvent;
