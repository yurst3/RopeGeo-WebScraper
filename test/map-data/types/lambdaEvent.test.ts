import { describe, it, expect } from '@jest/globals';
import { MapDataEvent } from '../../../src/map-data/types/lambdaEvent';
import { PageDataSource } from 'ropegeo-common/classes';
import type { SqsRecord } from '@aws-lambda-powertools/parser/types';

describe('MapDataEvent', () => {
    describe('constructor', () => {
        it('creates MapDataEvent with all properties', () => {
            const source = PageDataSource.Ropewiki;
            const routeId = '11111111-1111-1111-1111-111111111111';
            const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';

            const event = new MapDataEvent(source, routeId, pageId);

            expect(event.source).toBe(source);
            expect(event.routeId).toBe(routeId);
            expect(event.pageId).toBe(pageId);
            expect(event.downloadSource).toBe(true);
        });

        it('creates MapDataEvent with downloadSource false when mapDataId is provided', () => {
            const event = new MapDataEvent(
                PageDataSource.Ropewiki,
                'route-id',
                'page-id',
                'map-data-uuid',
                false,
            );
            expect(event.downloadSource).toBe(false);
            expect(event.mapDataId).toBe('map-data-uuid');
        });

        it('creates MapDataEvent with downloadSource false without mapDataId (validation is in fromSQSEventRecord)', () => {
            const event = new MapDataEvent(
                PageDataSource.Ropewiki,
                'route-id',
                'page-id',
                undefined,
                false,
            );
            expect(event.downloadSource).toBe(false);
            expect(event.mapDataId).toBeUndefined();
        });
    });

    describe('fromSQSEventRecord', () => {
        it('parses valid SQS record and returns MapDataEvent', () => {
            const source = PageDataSource.Ropewiki;
            const routeId = '11111111-1111-1111-1111-111111111111';
            const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';
            const downloadSource = true;

            const record: SqsRecord = {
                body: JSON.stringify({ source, routeId, pageId, downloadSource }),
            } as SqsRecord;

            const event = MapDataEvent.fromSQSEventRecord(record);

            expect(event).toBeInstanceOf(MapDataEvent);
            expect(event.source).toBe(source);
            expect(event.routeId).toBe(routeId);
            expect(event.pageId).toBe(pageId);
            expect(event.downloadSource).toBe(downloadSource);
        });

        it('throws error when SQS record body is missing', () => {
            const record: SqsRecord = {
                body: undefined,
            } as SqsRecord;

            expect(() => {
                MapDataEvent.fromSQSEventRecord(record);
            }).toThrow('SQS record missing body');
        });

        it('throws error when SQS record body is null', () => {
            const record: SqsRecord = {
                body: null as any,
            } as SqsRecord;

            expect(() => {
                MapDataEvent.fromSQSEventRecord(record);
            }).toThrow('SQS record missing body');
        });

        it('throws error when SQS record body is empty string', () => {
            const record: SqsRecord = {
                body: '',
            } as SqsRecord;

            expect(() => {
                MapDataEvent.fromSQSEventRecord(record);
            }).toThrow('SQS record missing body');
        });

        it('throws error when SQS record body is invalid JSON', () => {
            const record: SqsRecord = {
                body: 'invalid json{',
            } as SqsRecord;

            expect(() => {
                MapDataEvent.fromSQSEventRecord(record);
            }).toThrow('Failed to parse SQS record body as JSON');
        });

        it('throws error when downloadSource is missing', () => {
            const source = PageDataSource.Ropewiki;
            const routeId = '11111111-1111-1111-1111-111111111111';
            const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';

            const record: SqsRecord = {
                body: JSON.stringify({ source, routeId, pageId }),
            } as SqsRecord;

            expect(() => {
                MapDataEvent.fromSQSEventRecord(record);
            }).toThrow('Invalid MapDataEvent: downloadSource must be present and a boolean');
        });

        it('throws error when downloadSource is not a boolean', () => {
            const source = PageDataSource.Ropewiki;
            const routeId = '11111111-1111-1111-1111-111111111111';
            const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';

            const record: SqsRecord = {
                body: JSON.stringify({ source, routeId, pageId, downloadSource: 'true' }),
            } as SqsRecord;

            expect(() => {
                MapDataEvent.fromSQSEventRecord(record);
            }).toThrow('Invalid MapDataEvent: downloadSource must be present and a boolean');
        });

        it('throws error when source field is missing', () => {
            const routeId = '11111111-1111-1111-1111-111111111111';
            const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';

            const record: SqsRecord = {
                body: JSON.stringify({ routeId, pageId, downloadSource: true }),
            } as SqsRecord;

            expect(() => {
                MapDataEvent.fromSQSEventRecord(record);
            }).toThrow('Invalid MapDataEvent: missing required fields (source, routeId, pageId)');
        });

        it('throws error when routeId field is missing', () => {
            const source = PageDataSource.Ropewiki;
            const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';

            const record: SqsRecord = {
                body: JSON.stringify({ source, pageId, downloadSource: true }),
            } as SqsRecord;

            expect(() => {
                MapDataEvent.fromSQSEventRecord(record);
            }).toThrow('Invalid MapDataEvent: missing required fields (source, routeId, pageId)');
        });

        it('throws error when pageId field is missing', () => {
            const source = PageDataSource.Ropewiki;
            const routeId = '11111111-1111-1111-1111-111111111111';

            const record: SqsRecord = {
                body: JSON.stringify({ source, routeId, downloadSource: true }),
            } as SqsRecord;

            expect(() => {
                MapDataEvent.fromSQSEventRecord(record);
            }).toThrow('Invalid MapDataEvent: missing required fields (source, routeId, pageId)');
        });

        it('throws error when source field is null', () => {
            const routeId = '11111111-1111-1111-1111-111111111111';
            const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';

            const record: SqsRecord = {
                body: JSON.stringify({ source: null, routeId, pageId, downloadSource: true }),
            } as SqsRecord;

            expect(() => {
                MapDataEvent.fromSQSEventRecord(record);
            }).toThrow('Invalid MapDataEvent: missing required fields (source, routeId, pageId)');
        });

        it('throws error when routeId field is null', () => {
            const source = PageDataSource.Ropewiki;
            const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';

            const record: SqsRecord = {
                body: JSON.stringify({ source, routeId: null, pageId, downloadSource: true }),
            } as SqsRecord;

            expect(() => {
                MapDataEvent.fromSQSEventRecord(record);
            }).toThrow('Invalid MapDataEvent: missing required fields (source, routeId, pageId)');
        });

        it('throws error when pageId field is null', () => {
            const source = PageDataSource.Ropewiki;
            const routeId = '11111111-1111-1111-1111-111111111111';

            const record: SqsRecord = {
                body: JSON.stringify({ source, routeId, pageId: null, downloadSource: true }),
            } as SqsRecord;

            expect(() => {
                MapDataEvent.fromSQSEventRecord(record);
            }).toThrow('Invalid MapDataEvent: missing required fields (source, routeId, pageId)');
        });

        it('throws error when source field is empty string', () => {
            const routeId = '11111111-1111-1111-1111-111111111111';
            const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';

            const record: SqsRecord = {
                body: JSON.stringify({ source: '', routeId, pageId, downloadSource: true }),
            } as SqsRecord;

            expect(() => {
                MapDataEvent.fromSQSEventRecord(record);
            }).toThrow('Invalid MapDataEvent: missing required fields (source, routeId, pageId)');
        });

        it('throws error when routeId field is empty string', () => {
            const source = PageDataSource.Ropewiki;
            const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';

            const record: SqsRecord = {
                body: JSON.stringify({ source, routeId: '', pageId, downloadSource: true }),
            } as SqsRecord;

            expect(() => {
                MapDataEvent.fromSQSEventRecord(record);
            }).toThrow('Invalid MapDataEvent: missing required fields (source, routeId, pageId)');
        });

        it('throws error when pageId field is empty string', () => {
            const source = PageDataSource.Ropewiki;
            const routeId = '11111111-1111-1111-1111-111111111111';

            const record: SqsRecord = {
                body: JSON.stringify({ source, routeId, pageId: '', downloadSource: true }),
            } as SqsRecord;

            expect(() => {
                MapDataEvent.fromSQSEventRecord(record);
            }).toThrow('Invalid MapDataEvent: missing required fields (source, routeId, pageId)');
        });

        it('handles extra fields in JSON body', () => {
            const source = PageDataSource.Ropewiki;
            const routeId = '11111111-1111-1111-1111-111111111111';
            const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';

            const record: SqsRecord = {
                body: JSON.stringify({
                    source,
                    routeId,
                    pageId,
                    downloadSource: true,
                    extraField: 'should be ignored',
                    anotherField: 123,
                }),
            } as SqsRecord;

            const event = MapDataEvent.fromSQSEventRecord(record);

            expect(event).toBeInstanceOf(MapDataEvent);
            expect(event.source).toBe(source);
            expect(event.routeId).toBe(routeId);
            expect(event.pageId).toBe(pageId);
        });

        it('handles whitespace in JSON body', () => {
            const source = PageDataSource.Ropewiki;
            const routeId = '11111111-1111-1111-1111-111111111111';
            const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';

            const record: SqsRecord = {
                body: `  ${JSON.stringify({ source, routeId, pageId, downloadSource: true })}  `,
            } as SqsRecord;

            // JSON.parse should handle this, but let's verify it works
            const event = MapDataEvent.fromSQSEventRecord(record);

            expect(event).toBeInstanceOf(MapDataEvent);
            expect(event.source).toBe(source);
            expect(event.routeId).toBe(routeId);
            expect(event.pageId).toBe(pageId);
        });

        it('throws error when source is not a valid PageDataSource enum value', () => {
            const routeId = '11111111-1111-1111-1111-111111111111';
            const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';

            const record: SqsRecord = {
                body: JSON.stringify({ source: 'invalid-source', routeId, pageId, downloadSource: true }),
            } as SqsRecord;

            expect(() => {
                MapDataEvent.fromSQSEventRecord(record);
            }).toThrow('Invalid MapDataEvent: source must be one of ropewiki, got: invalid-source');
        });

        it('throws error when source is a number', () => {
            const routeId = '11111111-1111-1111-1111-111111111111';
            const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';

            const record: SqsRecord = {
                body: JSON.stringify({ source: 123, routeId, pageId, downloadSource: true }),
            } as SqsRecord;

            expect(() => {
                MapDataEvent.fromSQSEventRecord(record);
            }).toThrow('Invalid MapDataEvent: source must be one of ropewiki, got: 123');
        });

        it('throws error when source is a boolean', () => {
            const routeId = '11111111-1111-1111-1111-111111111111';
            const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';

            const record: SqsRecord = {
                body: JSON.stringify({ source: true, routeId, pageId, downloadSource: true }),
            } as SqsRecord;

            expect(() => {
                MapDataEvent.fromSQSEventRecord(record);
            }).toThrow('Invalid MapDataEvent: source must be one of ropewiki, got: true');
        });

        it('accepts valid PageDataSource enum value', () => {
            const source = PageDataSource.Ropewiki;
            const routeId = '11111111-1111-1111-1111-111111111111';
            const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';
            const mapDataId = 'existing-map-data-id';

            const record: SqsRecord = {
                body: JSON.stringify({
                    source: 'ropewiki',
                    routeId,
                    pageId,
                    mapDataId,
                    downloadSource: false,
                }),
            } as SqsRecord;

            const event = MapDataEvent.fromSQSEventRecord(record);

            expect(event).toBeInstanceOf(MapDataEvent);
            expect(event.source).toBe(PageDataSource.Ropewiki);
            expect(event.routeId).toBe(routeId);
            expect(event.pageId).toBe(pageId);
            expect(event.downloadSource).toBe(false);
            expect(event.mapDataId).toBe(mapDataId);
        });

        it('throws when downloadSource is false and mapDataId is missing', () => {
            const record: SqsRecord = {
                body: JSON.stringify({
                    source: PageDataSource.Ropewiki,
                    routeId: 'route-id',
                    pageId: 'page-id',
                    downloadSource: false,
                }),
            } as SqsRecord;

            expect(() => MapDataEvent.fromSQSEventRecord(record)).toThrow(
                'Invalid MapDataEvent: mapDataId is required when downloadSource is false',
            );
        });

        it('throws when downloadSource is false and mapDataId is empty string', () => {
            const record: SqsRecord = {
                body: JSON.stringify({
                    source: PageDataSource.Ropewiki,
                    routeId: 'route-id',
                    pageId: 'page-id',
                    mapDataId: '',
                    downloadSource: false,
                }),
            } as SqsRecord;

            expect(() => MapDataEvent.fromSQSEventRecord(record)).toThrow(
                'Invalid MapDataEvent: mapDataId is required when downloadSource is false',
            );
        });
    });
});
