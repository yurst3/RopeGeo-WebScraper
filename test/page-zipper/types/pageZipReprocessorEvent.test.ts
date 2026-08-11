import { describe, it, expect } from '@jest/globals';
import { PageZipReprocessorEvent } from '../../../src/page-zipper/types/pageZipReprocessorEvent';

const SAMPLE_ID = '0827ba8b-27b3-40dc-8385-06f823dbf535';
const SAMPLE_ID_2 = '8e7bb61c-13aa-4679-abba-ed144aa592cb';

describe('PageZipReprocessorEvent', () => {
    it('defaults clearMessagesAndJobs to false and includePageIds to undefined', () => {
        const created = new PageZipReprocessorEvent();
        expect(created.clearMessagesAndJobs).toBe(false);
        expect(created.includePageIds).toBeUndefined();

        expect(PageZipReprocessorEvent.fromParsedBody({}).clearMessagesAndJobs).toBe(false);
        expect(PageZipReprocessorEvent.fromLambdaEvent(undefined).clearMessagesAndJobs).toBe(
            false,
        );
    });

    it('fromParsedBody sets clearMessagesAndJobs and includePageIds', () => {
        expect(
            PageZipReprocessorEvent.fromParsedBody({ clearMessagesAndJobs: true })
                .clearMessagesAndJobs,
        ).toBe(true);
        expect(
            PageZipReprocessorEvent.fromParsedBody({
                includePageIds: [SAMPLE_ID, SAMPLE_ID_2],
            }).includePageIds,
        ).toEqual([SAMPLE_ID, SAMPLE_ID_2]);
    });

    it('throws on invalid clearMessagesAndJobs or includePageIds', () => {
        expect(() =>
            PageZipReprocessorEvent.fromParsedBody({ clearMessagesAndJobs: 'true' }),
        ).toThrow(/clearMessagesAndJobs must be a boolean/);
        expect(() =>
            PageZipReprocessorEvent.fromParsedBody({ includePageIds: [] }),
        ).toThrow(/non-empty array/);
        expect(() =>
            PageZipReprocessorEvent.fromParsedBody({ includePageIds: 'x' }),
        ).toThrow(/must be an array/);
        expect(() =>
            PageZipReprocessorEvent.fromParsedBody({ includePageIds: ['not-a-uuid'] }),
        ).toThrow(/invalid UUID/);
    });

    it('fromLambdaEvent parses API Gateway body and direct invoke root', () => {
        const fromBody = PageZipReprocessorEvent.fromLambdaEvent({
            body: JSON.stringify({
                clearMessagesAndJobs: true,
                includePageIds: [SAMPLE_ID],
            }),
        });
        expect(fromBody.clearMessagesAndJobs).toBe(true);
        expect(fromBody.includePageIds).toEqual([SAMPLE_ID]);

        expect(
            PageZipReprocessorEvent.fromLambdaEvent({ clearMessagesAndJobs: true })
                .clearMessagesAndJobs,
        ).toBe(true);
    });

    it('throws when body JSON is invalid', () => {
        expect(() =>
            PageZipReprocessorEvent.fromLambdaEvent({ body: '{' }),
        ).toThrow(/Failed to parse PageZipReprocessorEvent body as JSON/);
    });
});
