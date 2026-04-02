import { describe, it, expect } from '@jest/globals';
import { ImageVersion } from 'ropegeo-common/classes';
import { ReprocessImagesEvent } from '../../../src/ropewiki/types/reprocessImagesEvent';

describe('ReprocessImagesEvent', () => {
    it('defaults downloadSource and onlyUnprocessed to true', () => {
        const e = new ReprocessImagesEvent();
        expect(e.downloadSource).toBe(true);
        expect(e.onlyUnprocessed).toBe(true);
    });

    it('fromParsedBody applies overrides', () => {
        expect(ReprocessImagesEvent.fromParsedBody({})).toEqual(new ReprocessImagesEvent());

        const e = ReprocessImagesEvent.fromParsedBody({
            downloadSource: false,
            onlyUnprocessed: false,
        });
        expect(e.downloadSource).toBe(false);
        expect(e.onlyUnprocessed).toBe(false);
    });

    it('fromParsedBody throws when a field is not boolean', () => {
        expect(() => ReprocessImagesEvent.fromParsedBody({ downloadSource: 'true' })).toThrow(
            /downloadSource must be a boolean/,
        );
        expect(() => ReprocessImagesEvent.fromParsedBody({ onlyUnprocessed: 1 })).toThrow(
            /onlyUnprocessed must be a boolean/,
        );
    });

    it('fromLambdaEvent uses defaults when event is missing or has no body', () => {
        expect(ReprocessImagesEvent.fromLambdaEvent(undefined)).toEqual(new ReprocessImagesEvent());
        expect(ReprocessImagesEvent.fromLambdaEvent(null)).toEqual(new ReprocessImagesEvent());
        expect(ReprocessImagesEvent.fromLambdaEvent({})).toEqual(new ReprocessImagesEvent());
        expect(ReprocessImagesEvent.fromLambdaEvent({ body: '' })).toEqual(new ReprocessImagesEvent());
        expect(ReprocessImagesEvent.fromLambdaEvent({ body: null })).toEqual(new ReprocessImagesEvent());
    });

    it('fromLambdaEvent parses root object for direct Lambda invoke (no API Gateway body)', () => {
        const e = ReprocessImagesEvent.fromLambdaEvent({
            downloadSource: false,
            onlyUnprocessed: false,
            versions: [ImageVersion.linkPreview],
        });
        expect(e.downloadSource).toBe(false);
        expect(e.onlyUnprocessed).toBe(false);
        expect(e.versions).toEqual([ImageVersion.linkPreview]);
    });

    it('fromLambdaEvent parses JSON body', () => {
        const e = ReprocessImagesEvent.fromLambdaEvent({
            body: JSON.stringify({ downloadSource: false, onlyUnprocessed: false }),
        });
        expect(e.downloadSource).toBe(false);
        expect(e.onlyUnprocessed).toBe(false);
    });

    it('throws when downloadSource is false and onlyUnprocessed is true', () => {
        expect(
            () => new ReprocessImagesEvent({ downloadSource: false, onlyUnprocessed: true }),
        ).toThrow(/onlyUnprocessed cannot be true when downloadSource is false/);
        expect(() =>
            ReprocessImagesEvent.fromParsedBody({ downloadSource: false, onlyUnprocessed: true }),
        ).toThrow(/onlyUnprocessed cannot be true when downloadSource is false/);
        expect(() =>
            ReprocessImagesEvent.fromLambdaEvent({
                body: JSON.stringify({ downloadSource: false, onlyUnprocessed: true }),
            }),
        ).toThrow(/onlyUnprocessed cannot be true when downloadSource is false/);
    });

    it('fromLambdaEvent throws when body is invalid JSON', () => {
        expect(() => ReprocessImagesEvent.fromLambdaEvent({ body: 'not json' })).toThrow(
            /Failed to parse ReprocessImagesEvent body as JSON/,
        );
    });
});
