import { describe, it, expect } from '@jest/globals';
import { MapDataReprocessorEvent } from '../../../src/map-data/types/mapDataReprocessorEvent';

const SAMPLE_ID = '0827ba8b-27b3-40dc-8385-06f823dbf535';
const SAMPLE_ID_2 = '8e7bb61c-13aa-4679-abba-ed144aa592cb';

describe('MapDataReprocessorEvent', () => {
    it('defaults downloadSource and cleanOutlierPoints to false; processRelevantContext to true', () => {
        const created = new MapDataReprocessorEvent();
        expect(created.downloadSource).toBe(false);
        expect(created.cleanOutlierPoints).toBe(false);
        expect(created.processRelevantContext).toBe(true);
        expect(created.includeMapDataIds).toBeUndefined();

        const fromBody = MapDataReprocessorEvent.fromParsedBody({});
        expect(fromBody.downloadSource).toBe(false);
        expect(fromBody.cleanOutlierPoints).toBe(false);
        expect(fromBody.processRelevantContext).toBe(true);
        expect(fromBody.includeMapDataIds).toBeUndefined();

        const fromEvent = MapDataReprocessorEvent.fromLambdaEvent(undefined);
        expect(fromEvent.downloadSource).toBe(false);
        expect(fromEvent.cleanOutlierPoints).toBe(false);
        expect(fromEvent.processRelevantContext).toBe(true);
    });

    it('fromParsedBody sets downloadSource from object', () => {
        expect(MapDataReprocessorEvent.fromParsedBody({ downloadSource: true }).downloadSource).toBe(true);
        expect(MapDataReprocessorEvent.fromParsedBody({ downloadSource: false }).downloadSource).toBe(false);
    });

    it('fromParsedBody sets cleanOutlierPoints from object', () => {
        expect(
            MapDataReprocessorEvent.fromParsedBody({ cleanOutlierPoints: true }).cleanOutlierPoints,
        ).toBe(true);
        expect(
            MapDataReprocessorEvent.fromParsedBody({ cleanOutlierPoints: false }).cleanOutlierPoints,
        ).toBe(false);
    });

    it('fromParsedBody sets processRelevantContext from object', () => {
        expect(
            MapDataReprocessorEvent.fromParsedBody({ processRelevantContext: false })
                .processRelevantContext,
        ).toBe(false);
        expect(
            MapDataReprocessorEvent.fromParsedBody({ processRelevantContext: true })
                .processRelevantContext,
        ).toBe(true);
    });

    it('fromParsedBody sets includeMapDataIds from object', () => {
        const e = MapDataReprocessorEvent.fromParsedBody({
            includeMapDataIds: [SAMPLE_ID, SAMPLE_ID_2],
        });
        expect(e.includeMapDataIds).toEqual([SAMPLE_ID, SAMPLE_ID_2]);
        expect(e.downloadSource).toBe(false);
        expect(e.cleanOutlierPoints).toBe(false);
    });

    it('throws when downloadSource is not boolean', () => {
        expect(() => MapDataReprocessorEvent.fromParsedBody({ downloadSource: 'false' })).toThrow(
            /downloadSource must be a boolean/,
        );
    });

    it('throws when cleanOutlierPoints is not boolean', () => {
        expect(() => MapDataReprocessorEvent.fromParsedBody({ cleanOutlierPoints: 1 })).toThrow(
            /cleanOutlierPoints must be a boolean/,
        );
    });

    it('throws when processRelevantContext is not boolean', () => {
        expect(() => MapDataReprocessorEvent.fromParsedBody({ processRelevantContext: 'no' })).toThrow(
            /processRelevantContext must be a boolean/,
        );
    });

    it('throws when includeMapDataIds is not a non-empty UUID array', () => {
        expect(() => MapDataReprocessorEvent.fromParsedBody({ includeMapDataIds: [] })).toThrow(
            /non-empty array/,
        );
        expect(() => MapDataReprocessorEvent.fromParsedBody({ includeMapDataIds: 'x' })).toThrow(
            /must be an array/,
        );
        expect(() =>
            MapDataReprocessorEvent.fromParsedBody({ includeMapDataIds: ['not-a-uuid'] }),
        ).toThrow(/invalid UUID/);
    });

    it('fromLambdaEvent parses API Gateway-style body', () => {
        const e = MapDataReprocessorEvent.fromLambdaEvent({
            body: JSON.stringify({
                downloadSource: true,
                cleanOutlierPoints: true,
                processRelevantContext: false,
                includeMapDataIds: [SAMPLE_ID],
            }),
        });
        expect(e.downloadSource).toBe(true);
        expect(e.cleanOutlierPoints).toBe(true);
        expect(e.processRelevantContext).toBe(false);
        expect(e.includeMapDataIds).toEqual([SAMPLE_ID]);
    });

    it('fromLambdaEvent parses root payload for direct invoke', () => {
        expect(MapDataReprocessorEvent.fromLambdaEvent({ downloadSource: true }).downloadSource).toBe(
            true,
        );
        expect(
            MapDataReprocessorEvent.fromLambdaEvent({ cleanOutlierPoints: true }).cleanOutlierPoints,
        ).toBe(true);
        expect(
            MapDataReprocessorEvent.fromLambdaEvent({ processRelevantContext: false })
                .processRelevantContext,
        ).toBe(false);
        expect(
            MapDataReprocessorEvent.fromLambdaEvent({ includeMapDataIds: [SAMPLE_ID] }).includeMapDataIds,
        ).toEqual([SAMPLE_ID]);
    });

    it('fromLambdaEvent throws on invalid JSON body', () => {
        expect(() => MapDataReprocessorEvent.fromLambdaEvent({ body: 'not-json' })).toThrow(/parse.*JSON/i);
    });
});
