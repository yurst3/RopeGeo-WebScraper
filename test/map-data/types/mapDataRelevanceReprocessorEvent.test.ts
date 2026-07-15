import { describe, it, expect } from '@jest/globals';
import { MapDataRelevanceReprocessorEvent } from '../../../src/map-data/types/mapDataRelevanceReprocessorEvent';

const SAMPLE_ID = '0827ba8b-27b3-40dc-8385-06f823dbf535';
const SAMPLE_ID_2 = '8e7bb61c-13aa-4679-abba-ed144aa592cb';

describe('MapDataRelevanceReprocessorEvent', () => {
    it('defaults clearMessagesAndJobs to false and includeMapDataIds to undefined', () => {
        const created = new MapDataRelevanceReprocessorEvent();
        expect(created.clearMessagesAndJobs).toBe(false);
        expect(created.includeMapDataIds).toBeUndefined();

        const fromBody = MapDataRelevanceReprocessorEvent.fromParsedBody({});
        expect(fromBody.clearMessagesAndJobs).toBe(false);
        expect(fromBody.includeMapDataIds).toBeUndefined();

        const fromEvent = MapDataRelevanceReprocessorEvent.fromLambdaEvent(undefined);
        expect(fromEvent.clearMessagesAndJobs).toBe(false);
        expect(fromEvent.includeMapDataIds).toBeUndefined();
    });

    it('fromParsedBody sets clearMessagesAndJobs from object', () => {
        expect(
            MapDataRelevanceReprocessorEvent.fromParsedBody({ clearMessagesAndJobs: true })
                .clearMessagesAndJobs,
        ).toBe(true);
        expect(
            MapDataRelevanceReprocessorEvent.fromParsedBody({ clearMessagesAndJobs: false })
                .clearMessagesAndJobs,
        ).toBe(false);
    });

    it('fromParsedBody sets includeMapDataIds from object', () => {
        const e = MapDataRelevanceReprocessorEvent.fromParsedBody({
            includeMapDataIds: [SAMPLE_ID, SAMPLE_ID_2],
        });
        expect(e.includeMapDataIds).toEqual([SAMPLE_ID, SAMPLE_ID_2]);
        expect(e.clearMessagesAndJobs).toBe(false);
    });

    it('throws when clearMessagesAndJobs is not boolean', () => {
        expect(() =>
            MapDataRelevanceReprocessorEvent.fromParsedBody({ clearMessagesAndJobs: 'true' }),
        ).toThrow(/clearMessagesAndJobs must be a boolean/);
    });

    it('throws when includeMapDataIds is not a non-empty UUID array', () => {
        expect(() =>
            MapDataRelevanceReprocessorEvent.fromParsedBody({ includeMapDataIds: [] }),
        ).toThrow(/non-empty array/);
        expect(() =>
            MapDataRelevanceReprocessorEvent.fromParsedBody({ includeMapDataIds: 'x' }),
        ).toThrow(/must be an array/);
        expect(() =>
            MapDataRelevanceReprocessorEvent.fromParsedBody({ includeMapDataIds: ['not-a-uuid'] }),
        ).toThrow(/invalid UUID/);
    });

    it('fromLambdaEvent parses API Gateway-style body', () => {
        const e = MapDataRelevanceReprocessorEvent.fromLambdaEvent({
            body: JSON.stringify({
                clearMessagesAndJobs: true,
                includeMapDataIds: [SAMPLE_ID],
            }),
        });
        expect(e.clearMessagesAndJobs).toBe(true);
        expect(e.includeMapDataIds).toEqual([SAMPLE_ID]);
    });

    it('fromLambdaEvent parses root payload for direct invoke', () => {
        expect(
            MapDataRelevanceReprocessorEvent.fromLambdaEvent({ clearMessagesAndJobs: true })
                .clearMessagesAndJobs,
        ).toBe(true);
        expect(
            MapDataRelevanceReprocessorEvent.fromLambdaEvent({ includeMapDataIds: [SAMPLE_ID] })
                .includeMapDataIds,
        ).toEqual([SAMPLE_ID]);
    });

    it('fromLambdaEvent throws on invalid JSON body', () => {
        expect(() =>
            MapDataRelevanceReprocessorEvent.fromLambdaEvent({ body: 'not-json' }),
        ).toThrow(/parse.*JSON/i);
    });
});
