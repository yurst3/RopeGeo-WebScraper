import { describe, it, expect } from '@jest/globals';
import { ImageDataEvent } from '../../../src/image-data/types/lambdaEvent';
import { PageDataSource } from 'ropegeo-common';
import type { SqsRecord } from '@aws-lambda-powertools/parser/types';

describe('ImageDataEvent', () => {
    describe('constructor', () => {
        it('creates ImageDataEvent with all properties', () => {
            const id = '11111111-1111-1111-1111-111111111111';
            const sourceUrl = 'https://ropewiki.com/images/thumb/1/2/Example.jpg/400px-Example.jpg';

            const event = new ImageDataEvent(PageDataSource.Ropewiki, id, sourceUrl);

            expect(event.pageDataSource).toBe(PageDataSource.Ropewiki);
            expect(event.pageImageId).toBe(id);
            expect(event.sourceUrl).toBe(sourceUrl);
            expect(event.downloadSource).toBe(true);
        });

        it('throws when downloadSource is false without existingProcessedImageId', () => {
            const id = '11111111-1111-1111-1111-111111111111';
            const sourceUrl = 'https://ropewiki.com/images/thumb/1/2/Example.jpg/400px-Example.jpg';
            expect(() => {
                new ImageDataEvent(PageDataSource.Ropewiki, id, sourceUrl, false);
            }).toThrow(
                'Invalid ImageDataEvent: existingProcessedImageId is required when downloadSource is false',
            );
        });

        it('sets existingProcessedImageId when provided', () => {
            const id = '11111111-1111-1111-1111-111111111111';
            const sourceUrl = 'https://ropewiki.com/images/thumb/1/2/Example.jpg/400px-Example.jpg';
            const event = new ImageDataEvent(
                PageDataSource.Ropewiki,
                id,
                sourceUrl,
                false,
                'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            );
            expect(event.existingProcessedImageId).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
        });
    });

    describe('fromSQSEventRecord', () => {
        it('parses valid SQS record and returns ImageDataEvent', () => {
            const pageDataSource = PageDataSource.Ropewiki;
            const id = '11111111-1111-1111-1111-111111111111';
            const sourceUrl = 'https://ropewiki.com/images/thumb/1/2/Example.jpg/400px-Example.jpg';

            const record: SqsRecord = {
                body: JSON.stringify({ pageDataSource, pageImageId: id, sourceUrl, downloadSource: true }),
            } as SqsRecord;

            const event = ImageDataEvent.fromSQSEventRecord(record);

            expect(event).toBeInstanceOf(ImageDataEvent);
            expect(event.pageDataSource).toBe(pageDataSource);
            expect(event.pageImageId).toBe(id);
            expect(event.sourceUrl).toBe(sourceUrl);
            expect(event.downloadSource).toBe(true);
        });

        it('parses SQS body with legacy source field when sourceUrl is absent', () => {
            const pageDataSource = PageDataSource.Ropewiki;
            const id = '11111111-1111-1111-1111-111111111111';
            const legacyUrl = 'https://ropewiki.com/images/legacy.jpg';

            const record: SqsRecord = {
                body: JSON.stringify({ pageDataSource, pageImageId: id, source: legacyUrl, downloadSource: true }),
            } as SqsRecord;

            const event = ImageDataEvent.fromSQSEventRecord(record);
            expect(event.sourceUrl).toBe(legacyUrl);
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
            const sourceUrl = 'https://ropewiki.com/images/thumb/1/2/Example.jpg/400px-Example.jpg';

            const record: SqsRecord = {
                body: JSON.stringify({ pageImageId: id, sourceUrl, downloadSource: true }),
            } as SqsRecord;

            expect(() => {
                ImageDataEvent.fromSQSEventRecord(record);
            }).toThrow('Invalid ImageDataEvent: missing required fields (pageDataSource, pageImageId, sourceUrl)');
        });

        it('throws error when pageImageId field is missing', () => {
            const pageDataSource = PageDataSource.Ropewiki;
            const sourceUrl = 'https://ropewiki.com/images/thumb/1/2/Example.jpg/400px-Example.jpg';

            const record: SqsRecord = {
                body: JSON.stringify({ pageDataSource, sourceUrl, downloadSource: true }),
            } as SqsRecord;

            expect(() => {
                ImageDataEvent.fromSQSEventRecord(record);
            }).toThrow('Invalid ImageDataEvent: missing required fields (pageDataSource, pageImageId, sourceUrl)');
        });

        it('throws error when sourceUrl and legacy source are both missing', () => {
            const pageDataSource = PageDataSource.Ropewiki;
            const id = '11111111-1111-1111-1111-111111111111';

            const record: SqsRecord = {
                body: JSON.stringify({ pageDataSource, pageImageId: id, downloadSource: true }),
            } as SqsRecord;

            expect(() => {
                ImageDataEvent.fromSQSEventRecord(record);
            }).toThrow('Invalid ImageDataEvent: missing required fields (pageDataSource, pageImageId, sourceUrl)');
        });

        it('throws error when pageDataSource is not a valid PageDataSource enum value', () => {
            const id = '11111111-1111-1111-1111-111111111111';
            const sourceUrl = 'https://ropewiki.com/images/thumb/1/2/Example.jpg/400px-Example.jpg';

            const record: SqsRecord = {
                body: JSON.stringify({ pageDataSource: 'invalid', pageImageId: id, sourceUrl, downloadSource: true }),
            } as SqsRecord;

            expect(() => {
                ImageDataEvent.fromSQSEventRecord(record);
            }).toThrow(/Invalid ImageDataEvent: pageDataSource must be one of/);
        });

        it('accepts valid PageDataSource enum value (ropewiki)', () => {
            const id = '11111111-1111-1111-1111-111111111111';
            const sourceUrl = 'https://ropewiki.com/images/thumb/1/2/Example.jpg/400px-Example.jpg';

            const record: SqsRecord = {
                body: JSON.stringify({ pageDataSource: 'ropewiki', pageImageId: id, sourceUrl, downloadSource: true }),
            } as SqsRecord;

            const event = ImageDataEvent.fromSQSEventRecord(record);

            expect(event).toBeInstanceOf(ImageDataEvent);
            expect(event.pageDataSource).toBe(PageDataSource.Ropewiki);
            expect(event.pageImageId).toBe(id);
            expect(event.sourceUrl).toBe(sourceUrl);
            expect(event.downloadSource).toBe(true);
        });

        it('handles extra fields in JSON body', () => {
            const pageDataSource = PageDataSource.Ropewiki;
            const id = '11111111-1111-1111-1111-111111111111';
            const sourceUrl = 'https://ropewiki.com/images/thumb/1/2/Example.jpg/400px-Example.jpg';

            const record: SqsRecord = {
                body: JSON.stringify({
                    pageDataSource,
                    pageImageId: id,
                    sourceUrl,
                    downloadSource: false,
                    existingProcessedImageId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                    extraField: 'ignored',
                }),
            } as SqsRecord;

            const event = ImageDataEvent.fromSQSEventRecord(record);

            expect(event).toBeInstanceOf(ImageDataEvent);
            expect(event.pageDataSource).toBe(pageDataSource);
            expect(event.pageImageId).toBe(id);
            expect(event.sourceUrl).toBe(sourceUrl);
            expect(event.downloadSource).toBe(false);
            expect(event.existingProcessedImageId).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
        });

        it('throws error when downloadSource is missing', () => {
            const pageDataSource = PageDataSource.Ropewiki;
            const id = '11111111-1111-1111-1111-111111111111';
            const sourceUrl = 'https://ropewiki.com/images/thumb/1/2/Example.jpg/400px-Example.jpg';
            const record: SqsRecord = {
                body: JSON.stringify({ pageDataSource, pageImageId: id, sourceUrl }),
            } as SqsRecord;

            expect(() => {
                ImageDataEvent.fromSQSEventRecord(record);
            }).toThrow('Invalid ImageDataEvent: downloadSource must be present and a boolean');
        });

        it('throws error when downloadSource is not a boolean', () => {
            const pageDataSource = PageDataSource.Ropewiki;
            const id = '11111111-1111-1111-1111-111111111111';
            const sourceUrl = 'https://ropewiki.com/images/thumb/1/2/Example.jpg/400px-Example.jpg';
            const record: SqsRecord = {
                body: JSON.stringify({ pageDataSource, pageImageId: id, sourceUrl, downloadSource: 'true' }),
            } as SqsRecord;

            expect(() => {
                ImageDataEvent.fromSQSEventRecord(record);
            }).toThrow('Invalid ImageDataEvent: downloadSource must be present and a boolean');
        });

        it('accepts existingProcessedImageId when provided', () => {
            const pageDataSource = PageDataSource.Ropewiki;
            const id = '11111111-1111-1111-1111-111111111111';
            const sourceUrl = 'https://ropewiki.com/images/thumb/1/2/Example.jpg/400px-Example.jpg';
            const record: SqsRecord = {
                body: JSON.stringify({
                    pageDataSource,
                    pageImageId: id,
                    sourceUrl,
                    downloadSource: false,
                    existingProcessedImageId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                }),
            } as SqsRecord;

            const event = ImageDataEvent.fromSQSEventRecord(record);
            expect(event.existingProcessedImageId).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
        });

        it('throws when existingProcessedImageId is not a string', () => {
            const pageDataSource = PageDataSource.Ropewiki;
            const id = '11111111-1111-1111-1111-111111111111';
            const sourceUrl = 'https://ropewiki.com/images/thumb/1/2/Example.jpg/400px-Example.jpg';
            const record: SqsRecord = {
                body: JSON.stringify({
                    pageDataSource,
                    pageImageId: id,
                    sourceUrl,
                    downloadSource: false,
                    existingProcessedImageId: 123,
                }),
            } as SqsRecord;

            expect(() => {
                ImageDataEvent.fromSQSEventRecord(record);
            }).toThrow(
                'Invalid ImageDataEvent: existingProcessedImageId is required when downloadSource is false',
            );
        });

        it('throws when downloadSource is false and existingProcessedImageId is missing', () => {
            const pageDataSource = PageDataSource.Ropewiki;
            const id = '11111111-1111-1111-1111-111111111111';
            const sourceUrl = 'https://ropewiki.com/images/thumb/1/2/Example.jpg/400px-Example.jpg';
            const record: SqsRecord = {
                body: JSON.stringify({
                    pageDataSource,
                    pageImageId: id,
                    sourceUrl,
                    downloadSource: false,
                }),
            } as SqsRecord;

            expect(() => {
                ImageDataEvent.fromSQSEventRecord(record);
            }).toThrow(
                'Invalid ImageDataEvent: existingProcessedImageId is required when downloadSource is false',
            );
        });
    });
});
