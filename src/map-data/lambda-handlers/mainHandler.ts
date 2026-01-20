import { main } from '../main';
import type { SqsEvent, SqsRecord } from '@aws-lambda-powertools/parser/types';
import { PageDataSource } from '../types/mapData';

export interface MapDataEvent {
    source: PageDataSource;
    routeId: string;
    pageId: string;
}

/**
 * Parses a MapDataEvent from an SQS record body.
 */
export const fromSQSEventRecord = (record: SqsRecord): MapDataEvent => {
    if (!record.body) {
        throw new Error('SQS record missing body');
    }

    try {
        const parsed = JSON.parse(record.body) as MapDataEvent;
        
        if (!parsed.source || !parsed.routeId || !parsed.pageId) {
            throw new Error('Invalid MapDataEvent: missing required fields (source, routeId, pageId)');
        }

        return parsed;
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error(`Failed to parse SQS record body as JSON: ${error.message}`);
        }
        throw error;
    }
};

/**
 * Lambda handler for processing map data (KML to MBTiles conversion).
 * Expects an SQS event with Records array containing the MapDataEvent in the body.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mainHandler = async (event: SqsEvent, context: any) => {
    try {
        // Validate SQS event format
        if (!event.Records || !Array.isArray(event.Records) || event.Records.length === 0) {
            throw new Error('Invalid SQS event: missing Records array or empty Records');
        }

        // Process the first record (BatchSize is 1, so there should only be one)
        const record: SqsRecord = event.Records[0]!;
        const mapDataEvent = fromSQSEventRecord(record);

        // Validate source
        if (mapDataEvent.source !== PageDataSource.Ropewiki) {
            throw new Error(`Unsupported source: ${mapDataEvent.source}`);
        }

        // Process the map data using the main function
        await main(mapDataEvent.source, mapDataEvent.pageId, mapDataEvent.routeId);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Map data processed successfully',
                routeId: mapDataEvent.routeId,
                pageId: mapDataEvent.pageId,
                source: mapDataEvent.source,
            }),
        };
    } catch (error) {
        console.error('Error processing map data:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Failed to process map data',
                error: error instanceof Error ? error.message : String(error),
            }),
        };
    }
};
