import type { SqsRecord } from '@aws-lambda-powertools/parser/types';
import { PageDataSource } from 'ropegeo-common/models';

export class RelevanceJobEvent {
    readonly id: string;
    readonly mapDataId: string;
    readonly pageId: string;
    readonly pageSource: PageDataSource;
    readonly makeDownloadFolder: boolean;

    constructor(
        id: string,
        mapDataId: string,
        pageId: string,
        pageSource: PageDataSource,
        makeDownloadFolder: boolean = true,
    ) {
        this.id = id;
        this.mapDataId = mapDataId;
        this.pageId = pageId;
        this.pageSource = pageSource;
        this.makeDownloadFolder = makeDownloadFolder;
    }

    static fromSQSEventRecord(record: SqsRecord): RelevanceJobEvent {
        if (!record.body) {
            throw new Error('SQS record missing body');
        }

        try {
            const parsed = JSON.parse(record.body) as {
                id?: string;
                mapDataId?: string;
                pageId?: string;
                pageSource?: PageDataSource;
                makeDownloadFolder?: boolean | null;
            };

            if (!parsed.id || !parsed.mapDataId || !parsed.pageId || !parsed.pageSource) {
                throw new Error(
                    'Invalid RelevanceJobEvent: missing required fields (id, mapDataId, pageId, pageSource)',
                );
            }

            if (!Object.values(PageDataSource).includes(parsed.pageSource)) {
                throw new Error(
                    `Invalid RelevanceJobEvent: pageSource must be one of ${Object.values(PageDataSource).join(', ')}, got: ${parsed.pageSource}`,
                );
            }

            if (
                parsed.makeDownloadFolder != null &&
                typeof parsed.makeDownloadFolder !== 'boolean'
            ) {
                throw new Error(
                    'Invalid RelevanceJobEvent: makeDownloadFolder must be a boolean when provided',
                );
            }

            return new RelevanceJobEvent(
                parsed.id,
                parsed.mapDataId,
                parsed.pageId,
                parsed.pageSource,
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

export default RelevanceJobEvent;
