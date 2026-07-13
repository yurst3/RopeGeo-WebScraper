import { describe, it, expect } from '@jest/globals';
import type { SqsRecord } from '@aws-lambda-powertools/parser/types';
import { PageDataSource } from 'ropegeo-common/models';
import RelevanceJobEvent from '../../../src/map-data/types/relevanceJobEvent';

function record(body: unknown): SqsRecord {
    return {
        body: typeof body === 'string' ? body : JSON.stringify(body),
    } as SqsRecord;
}

describe('RelevanceJobEvent', () => {
    it('parses a valid SQS body', () => {
        const event = RelevanceJobEvent.fromSQSEventRecord(
            record({
                id: 'job-1',
                mapDataId: 'map-1',
                pageId: 'page-1',
                pageSource: PageDataSource.Ropewiki,
            }),
        );
        expect(event).toEqual(
            new RelevanceJobEvent('job-1', 'map-1', 'page-1', PageDataSource.Ropewiki),
        );
    });

    it('throws when required fields are missing', () => {
        expect(() =>
            RelevanceJobEvent.fromSQSEventRecord(record({ id: 'job-1' })),
        ).toThrow(/missing required fields/);
    });

    it('throws when pageSource is invalid', () => {
        expect(() =>
            RelevanceJobEvent.fromSQSEventRecord(
                record({
                    id: 'job-1',
                    mapDataId: 'map-1',
                    pageId: 'page-1',
                    pageSource: 'not-a-source',
                }),
            ),
        ).toThrow(/pageSource must be one of/);
    });

    it('throws when body is not JSON', () => {
        expect(() => RelevanceJobEvent.fromSQSEventRecord(record('{'))).toThrow(
            /Failed to parse SQS record body as JSON/,
        );
    });
});
