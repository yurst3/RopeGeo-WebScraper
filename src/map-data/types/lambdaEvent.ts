import type { SqsRecord } from '@aws-lambda-powertools/parser/types';
import { PageDataSource } from '../../types/pageRoute';

export class MapDataEvent {
    source: PageDataSource;
    routeId: string;
    pageId: string;
    mapDataId: string | undefined;

    constructor(
        source: PageDataSource,
        routeId: string,
        pageId: string,
        mapDataId?: string,
    ) {
        this.source = source;
        this.routeId = routeId;
        this.pageId = pageId;
        this.mapDataId = mapDataId;
    }

    /**
     * Parses a MapDataEvent from an SQS record body.
     */
    static fromSQSEventRecord(record: SqsRecord): MapDataEvent {
        if (!record.body) {
            throw new Error('SQS record missing body');
        }

        try {
            const parsed = JSON.parse(record.body) as { source?: PageDataSource; routeId?: string; pageId?: string; mapDataId?: string };
            
            if (!parsed.source || !parsed.routeId || !parsed.pageId) {
                throw new Error('Invalid MapDataEvent: missing required fields (source, routeId, pageId)');
            }

            // Validate that source is a valid PageDataSource enum value
            if (!Object.values(PageDataSource).includes(parsed.source)) {
                throw new Error(`Invalid MapDataEvent: source must be one of ${Object.values(PageDataSource).join(', ')}, got: ${parsed.source}`);
            }

            return new MapDataEvent(parsed.source, parsed.routeId, parsed.pageId, parsed.mapDataId);
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error(`Failed to parse SQS record body as JSON: ${error.message}`);
            }
            throw error;
        }
    }
}

export default MapDataEvent;
