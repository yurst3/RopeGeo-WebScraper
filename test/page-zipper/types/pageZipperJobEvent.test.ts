import { describe, it, expect } from '@jest/globals';
import type { SqsRecord } from '@aws-lambda-powertools/parser/types';
import { PageDataSource } from 'ropegeo-common/models';
import PageZipperJobEvent from '../../../src/page-zipper/types/pageZipperJobEvent';

function record(body: unknown): SqsRecord {
    return {
        body: typeof body === 'string' ? body : JSON.stringify(body),
    } as SqsRecord;
}

describe('PageZipperJobEvent', () => {
    it('parses a valid SQS body', () => {
        const event = PageZipperJobEvent.fromSQSEventRecord(
            record({
                id: 'job-1',
                pageId: 'page-1',
                pageSource: PageDataSource.Ropewiki,
            }),
        );
        expect(event).toEqual(
            new PageZipperJobEvent('job-1', 'page-1', PageDataSource.Ropewiki),
        );
    });

    it('throws when required fields are missing', () => {
        expect(() =>
            PageZipperJobEvent.fromSQSEventRecord(record({ id: 'job-1' })),
        ).toThrow(/missing required fields/);
    });

    it('throws when pageSource is invalid', () => {
        expect(() =>
            PageZipperJobEvent.fromSQSEventRecord(
                record({
                    id: 'job-1',
                    pageId: 'page-1',
                    pageSource: 'not-a-source',
                }),
            ),
        ).toThrow(/pageSource must be one of/);
    });

    it('throws when body is missing or invalid JSON', () => {
        expect(() =>
            PageZipperJobEvent.fromSQSEventRecord({ body: undefined } as SqsRecord),
        ).toThrow('SQS record missing body');
        expect(() =>
            PageZipperJobEvent.fromSQSEventRecord(record('{')),
        ).toThrow(/Failed to parse SQS record body as JSON/);
    });
});
