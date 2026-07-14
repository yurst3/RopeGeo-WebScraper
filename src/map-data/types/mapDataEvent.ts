import type { SqsRecord } from '@aws-lambda-powertools/parser/types';
import { PageDataSource } from 'ropegeo-common/models';

export class MapDataEvent {
    source: PageDataSource;
    routeId: string;
    pageId: string;
    mapDataId: string | undefined;
    downloadSource: boolean;
    /** When true, identify and clean GPS track-sample outlier points before enrich/upload. */
    cleanOutlierPoints: boolean;
    /**
     * When true (default), after a successful MapData upsert the processor upserts and may enqueue
     * a MapDataRelevantContextJob. When false, that step is skipped.
     */
    processRelevantContext: boolean;

    constructor(
        source: PageDataSource,
        routeId: string,
        pageId: string,
        mapDataId?: string,
        downloadSource: boolean = true,
        cleanOutlierPoints: boolean = false,
        processRelevantContext: boolean = true,
    ) {
        this.source = source;
        this.routeId = routeId;
        this.pageId = pageId;
        this.mapDataId = mapDataId;
        this.downloadSource = downloadSource;
        this.cleanOutlierPoints = cleanOutlierPoints;
        this.processRelevantContext = processRelevantContext;
    }

    /**
     * Parses a MapDataEvent from an SQS record body.
     */
    static fromSQSEventRecord(record: SqsRecord): MapDataEvent {
        if (!record.body) {
            throw new Error('SQS record missing body');
        }

        try {
            const parsed = JSON.parse(record.body) as {
                source?: PageDataSource;
                routeId?: string;
                pageId?: string;
                mapDataId?: string;
                downloadSource?: boolean;
                cleanOutlierPoints?: boolean;
                processRelevantContext?: boolean;
            };

            if (!parsed.source || !parsed.routeId || !parsed.pageId) {
                throw new Error('Invalid MapDataEvent: missing required fields (source, routeId, pageId)');
            }

            if (typeof parsed.downloadSource !== 'boolean') {
                throw new Error('Invalid MapDataEvent: downloadSource must be present and a boolean');
            }

            if (parsed.downloadSource === false && (!parsed.mapDataId || parsed.mapDataId === '')) {
                throw new Error('Invalid MapDataEvent: mapDataId is required when downloadSource is false');
            }

            if (
                parsed.cleanOutlierPoints !== undefined &&
                typeof parsed.cleanOutlierPoints !== 'boolean'
            ) {
                throw new Error('Invalid MapDataEvent: cleanOutlierPoints must be a boolean when provided');
            }

            if (
                parsed.processRelevantContext !== undefined &&
                typeof parsed.processRelevantContext !== 'boolean'
            ) {
                throw new Error(
                    'Invalid MapDataEvent: processRelevantContext must be a boolean when provided',
                );
            }

            // Validate that source is a valid PageDataSource enum value
            if (!Object.values(PageDataSource).includes(parsed.source)) {
                throw new Error(`Invalid MapDataEvent: source must be one of ${Object.values(PageDataSource).join(', ')}, got: ${parsed.source}`);
            }

            return new MapDataEvent(
                parsed.source,
                parsed.routeId,
                parsed.pageId,
                parsed.mapDataId,
                parsed.downloadSource,
                parsed.cleanOutlierPoints ?? false,
                parsed.processRelevantContext ?? true,
            );
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error(`Failed to parse SQS record body as JSON: ${error.message}`);
            }
            throw error;
        }
    }
}

export default MapDataEvent;
