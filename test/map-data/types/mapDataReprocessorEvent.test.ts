import { describe, it, expect } from '@jest/globals';
import { MapDataReprocessorEvent } from '../../../src/map-data/types/mapDataReprocessorEvent';

describe('MapDataReprocessorEvent', () => {
    it('defaults downloadSource to false', () => {
        expect(new MapDataReprocessorEvent().downloadSource).toBe(false);
        expect(MapDataReprocessorEvent.fromParsedBody({}).downloadSource).toBe(false);
        expect(MapDataReprocessorEvent.fromLambdaEvent(undefined).downloadSource).toBe(false);
    });

    it('fromParsedBody sets downloadSource from object', () => {
        expect(MapDataReprocessorEvent.fromParsedBody({ downloadSource: true }).downloadSource).toBe(true);
        expect(MapDataReprocessorEvent.fromParsedBody({ downloadSource: false }).downloadSource).toBe(false);
    });

    it('throws when downloadSource is not boolean', () => {
        expect(() => MapDataReprocessorEvent.fromParsedBody({ downloadSource: 'false' })).toThrow(
            /downloadSource must be a boolean/,
        );
    });

    it('fromLambdaEvent parses API Gateway-style body', () => {
        const e = MapDataReprocessorEvent.fromLambdaEvent({
            body: JSON.stringify({ downloadSource: true }),
        });
        expect(e.downloadSource).toBe(true);
    });

    it('fromLambdaEvent parses root payload for direct invoke', () => {
        expect(MapDataReprocessorEvent.fromLambdaEvent({ downloadSource: true }).downloadSource).toBe(true);
    });

    it('fromLambdaEvent throws on invalid JSON body', () => {
        expect(() => MapDataReprocessorEvent.fromLambdaEvent({ body: 'not-json' })).toThrow(/parse.*JSON/i);
    });
});
