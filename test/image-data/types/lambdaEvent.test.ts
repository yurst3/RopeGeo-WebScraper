import { describe, it, expect } from '@jest/globals';
import { ImageDataEvent } from '../../../src/image-data/types/lambdaEvent';
import { PageDataSource } from 'ropegeo-common';
import type { SqsRecord } from '@aws-lambda-powertools/parser/types';

describe('ImageDataEvent', () => {
    describe('constructor', () => {
        it('creates ImageDataEvent with all properties', () => {
            const id = '11111111-1111-1111-1111-111111111111';
            const source = 'https://ropewiki.com/images/thumb/1/2/Example.jpg/400px-Example.jpg';

            const event = new ImageDataEvent(PageDataSource.Ropewiki, id, source);

            expect(event.pageDataSource).toBe(PageDataSource.Ropewiki);
            expect(event.id).toBe(id);
            expect(event.source).toBe(source);
        });
    });

    describe('fromSQSEventRecord', () => {
        it('parses valid SQS record and returns ImageDataEvent', () => {
            const pageDataSource = PageDataSource.Ropewiki;
            const id = '11111111-1111-1111-1111-111111111111';
            const source = 'https://ropewiki.com/images/thumb/1/2/Example.jpg/400px-Example.jpg';

            const record: SqsRecord = {
                body: JSON.stringify({ pageDataSource, id, source }),
            } as SqsRecord;

            const event = ImageDataEvent.fromSQSEventRecord(record);

            expect(event).toBeInstanceOf(ImageDataEvent);
            expect(event.pageDataSource).toBe(pageDataSource);
            expect(event.id).toBe(id);
            expect(event.source).toBe(source);
        });

        it('throws error when SQS record body is missing', () => {
            const record: SqsRecord = {
                body: undefined,
            } as SqsRecord;

            expect(() => {
                ImageDataEvent.fromSQSEventRecord(record);
            }).toThrow('SQS record missing body');
        });

        it('throws error when SQS record body is null', () => {
            const record: SqsRecord = {
                body: null as any,
            } as SqsRecord;

            expect(() => {
                ImageDataEvent.fromSQSEventRecord(record);
            }).toThrow('SQS record missing body');
        });

        it('throws error when SQS record body is empty string', () => {
            const record: SqsRecord = {
                body: '',
            } as SqsRecord;

            expect(() => {
                ImageDataEvent.fromSQSEventRecord(record);
            }).toThrow('SQS record missing body');
        });

        it('throws error when SQS record body is invalid JSON', () => {
            const record: SqsRecord = {
                body: 'invalid json{',
            } as SqsRecord;

            expect(() => {
                ImageDataEvent.fromSQSEventRecord(record);
            }).toThrow('Failed to parse SQS record body as JSON');
        });

        it('throws error when pageDataSource field is missing', () => {
            const id = '11111111-1111-1111-1111-111111111111';
            const source = 'https://ropewiki.com/images/thumb/1/2/Example.jpg/400px-Example.jpg';

            const record: SqsRecord = {
                body: JSON.stringify({ id, source }),
            } as SqsRecord;

            expect(() => {
                ImageDataEvent.fromSQSEventRecord(record);
            }).toThrow('Invalid ImageDataEvent: missing required fields (pageDataSource, id, source)');
        });

        it('throws error when id field is missing', () => {
            const pageDataSource = PageDataSource.Ropewiki;
            const source = 'https://ropewiki.com/images/thumb/1/2/Example.jpg/400px-Example.jpg';

            const record: SqsRecord = {
                body: JSON.stringify({ pageDataSource, source }),
            } as SqsRecord;

            expect(() => {
                ImageDataEvent.fromSQSEventRecord(record);
            }).toThrow('Invalid ImageDataEvent: missing required fields (pageDataSource, id, source)');
        });

        it('throws error when source field is missing', () => {
            const pageDataSource = PageDataSource.Ropewiki;
            const id = '11111111-1111-1111-1111-111111111111';

            const record: SqsRecord = {
                body: JSON.stringify({ pageDataSource, id }),
            } as SqsRecord;

            expect(() => {
                ImageDataEvent.fromSQSEventRecord(record);
            }).toThrow('Invalid ImageDataEvent: missing required fields (pageDataSource, id, source)');
        });

        it('throws error when pageDataSource is not a valid PageDataSource enum value', () => {
            const id = '11111111-1111-1111-1111-111111111111';
            const source = 'https://ropewiki.com/images/thumb/1/2/Example.jpg/400px-Example.jpg';

            const record: SqsRecord = {
                body: JSON.stringify({ pageDataSource: 'invalid', id, source }),
            } as SqsRecord;

            expect(() => {
                ImageDataEvent.fromSQSEventRecord(record);
            }).toThrow(/Invalid ImageDataEvent: pageDataSource must be one of/);
        });

        it('accepts valid PageDataSource enum value (ropewiki)', () => {
            const id = '11111111-1111-1111-1111-111111111111';
            const source = 'https://ropewiki.com/images/thumb/1/2/Example.jpg/400px-Example.jpg';

            const record: SqsRecord = {
                body: JSON.stringify({ pageDataSource: 'ropewiki', id, source }),
            } as SqsRecord;

            const event = ImageDataEvent.fromSQSEventRecord(record);

            expect(event).toBeInstanceOf(ImageDataEvent);
            expect(event.pageDataSource).toBe(PageDataSource.Ropewiki);
            expect(event.id).toBe(id);
            expect(event.source).toBe(source);
        });

        it('handles extra fields in JSON body', () => {
            const pageDataSource = PageDataSource.Ropewiki;
            const id = '11111111-1111-1111-1111-111111111111';
            const source = 'https://ropewiki.com/images/thumb/1/2/Example.jpg/400px-Example.jpg';

            const record: SqsRecord = {
                body: JSON.stringify({
                    pageDataSource,
                    id,
                    source,
                    extraField: 'ignored',
                }),
            } as SqsRecord;

            const event = ImageDataEvent.fromSQSEventRecord(record);

            expect(event).toBeInstanceOf(ImageDataEvent);
            expect(event.pageDataSource).toBe(pageDataSource);
            expect(event.id).toBe(id);
            expect(event.source).toBe(source);
        });
    });
});
