import { describe, it, expect } from '@jest/globals';
import buildImageDataReady from '../../../src/ropewiki/util/buildImageDataReady';

describe('buildImageDataReady', () => {
    it('returns empty object when there are no upserted images', () => {
        expect(buildImageDataReady([], [{ id: 'img-1' }])).toEqual({});
    });

    it('skips upserted images without an id', () => {
        expect(
            buildImageDataReady(
                [{ id: undefined }, { id: null }, { id: '' }, { id: 'img-1' }],
                [],
            ),
        ).toEqual({ 'img-1': true });
    });

    it('marks images not in toProcess as ready', () => {
        expect(
            buildImageDataReady(
                [{ id: 'img-1' }, { id: 'img-2' }],
                [],
            ),
        ).toEqual({ 'img-1': true, 'img-2': true });
    });

    it('marks images in toProcess as not ready', () => {
        expect(
            buildImageDataReady(
                [{ id: 'img-1' }, { id: 'img-2' }, { id: 'img-3' }],
                [{ id: 'img-2' }, { id: '' }, { id: undefined }],
            ),
        ).toEqual({ 'img-1': true, 'img-2': false, 'img-3': true });
    });
});
