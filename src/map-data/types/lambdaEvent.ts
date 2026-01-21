import type { SqsRecord } from '@aws-lambda-powertools/parser/types';
import { PageDataSource } from './mapData';

export class MapDataEvent {
    source: PageDataSource;
    routeId: string;
    pageId: string;

    constructor(
        source: PageDataSource,
        routeId: string,
        pageId: string,
    ) {
        this.source = source;
        this.routeId = routeId;
        this.pageId = pageId;
    }

    /**
     * Parses a MapDataEvent from an SQS record body.
     */
    static fromSQSEventRecord(record: SqsRecord): MapDataEvent {
        if (!record.body) {
            throw new Error('SQS record missing body');
        }

        try {
            const parsed = JSON.parse(record.body) as { source?: PageDataSource; routeId?: string; pageId?: string };
            
            if (!parsed.source || !parsed.routeId || !parsed.pageId) {
                throw new Error('Invalid MapDataEvent: missing required fields (source, routeId, pageId)');
            }

            // Validate that source is a valid PageDataSource enum value
            if (!Object.values(PageDataSource).includes(parsed.source)) {
                throw new Error(`Invalid MapDataEvent: source must be one of ${Object.values(PageDataSource).join(', ')}, got: ${parsed.source}`);
            }

            return new MapDataEvent(parsed.source, parsed.routeId, parsed.pageId);
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error(`Failed to parse SQS record body as JSON: ${error.message}`);
            }
            throw error;
        }
    }
}

export default MapDataEvent;
