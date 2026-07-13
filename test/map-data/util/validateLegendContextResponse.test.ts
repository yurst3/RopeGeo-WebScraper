import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { validateLegendContext } from '../../../src/map-data/util/validateLegendContextResponse';
import type { PageRelevanceInput } from '../../../src/map-data/types/relevanceTypes';

describe('validateLegendContext', () => {
    const input: PageRelevanceInput = {
        page: { id: 'p1', name: 'Page', url: 'https://example.com' },
        mapDataId: 'm1',
        legendItems: [],
        betaSections: [{ id: 'beta-1', title: 'Descent', text: 'text', order: 0 }],
        images: [
            {
                id: 'img-1',
                betaSectionId: 'beta-1',
                betaSectionTitle: 'Descent',
                caption: 'A caption',
                order: 0,
            },
        ],
        pageStats: {},
    };

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('drops beta excerpts and images with unknown ids', () => {
        const validated = validateLegendContext(
            {
                measurements: null,
                betaSectionExcerpts: [
                    { id: 'beta-1', text: 'ok', confidence: 0.9 },
                    { id: 'missing', text: 'bad', confidence: 0.5 },
                ],
                images: [
                    { id: 'img-1', betaSectionId: 'beta-1', confidence: 0.8 },
                    { id: 'img-missing', betaSectionId: null, confidence: 0.2 },
                ],
            },
            input,
        );

        expect(validated.betaSectionExcerpts).toEqual([
            { id: 'beta-1', text: 'ok', confidence: 0.9 },
        ]);
        expect(validated.images).toEqual([
            { id: 'img-1', betaSectionId: 'beta-1', confidence: 0.8 },
        ]);
    });

    it('nulls invalid betaSectionId on otherwise valid images', () => {
        const validated = validateLegendContext(
            {
                measurements: null,
                betaSectionExcerpts: null,
                images: [{ id: 'img-1', betaSectionId: 'not-a-section', confidence: 0.7 }],
            },
            input,
        );

        expect(validated.images).toEqual([
            { id: 'img-1', betaSectionId: null, confidence: 0.7 },
        ]);
    });

    it('nulls arrays when every entry is removed', () => {
        const validated = validateLegendContext(
            {
                measurements: null,
                betaSectionExcerpts: [{ id: 'missing', text: 'x', confidence: 1 }],
                images: [{ id: 'missing', betaSectionId: null, confidence: 1 }],
            },
            input,
        );

        expect(validated.betaSectionExcerpts).toBeNull();
        expect(validated.images).toBeNull();
    });
});
