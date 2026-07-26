import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { validateLegendContext } from '../../../src/map-data/util/validateLegendContextResponse';
import type {
    LegendItemInput,
    PageRelevanceInput,
} from '../../../src/map-data/types/relevanceTypes';

describe('validateLegendContext', () => {
    const pointItem: LegendItemInput = {
        id: 'li-point',
        featureType: 'point',
        name: '1st Rappel',
    };
    const lineItem: LegendItemInput = {
        id: 'li-line',
        featureType: 'line',
        name: 'Approach',
    };

    const input: PageRelevanceInput = {
        page: { id: 'p1', name: 'Page', url: 'https://example.com' },
        mapDataId: 'm1',
        legendItems: [],
        betaSections: [
            {
                id: 'beta-1',
                title: 'Descent',
                text: 'Then find your first bolted rap. Keep left.',
                order: 0,
            },
        ],
        images: [
            {
                id: 'img-1',
                betaSectionId: 'beta-1',
                betaSectionTitle: 'Descent',
                caption: 'La Capella Waterfall',
                order: 0,
            },
        ],
        pageStats: {
            approachElevGain: { value: 400, unitName: 'feet' },
            approachLength: { value: 1.2, unitName: 'miles' },
        },
    };

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('drops beta excerpts and images with unknown ids', () => {
        const validated = validateLegendContext(
            {
                measurements: null,
                betaSectionExcerpts: [
                    {
                        id: 'beta-1',
                        text: 'Then find your first bolted rap. Keep left.',
                        relevanceStrength: 'Somewhat Relevant',
                        relevantPhrase: 'first bolted rap',
                    },
                    {
                        id: 'missing',
                        text: 'bad',
                        relevanceStrength: 'Maybe Relevant',
                        relevantPhrase: 'bad',
                    },
                ],
                images: [
                    {
                        id: 'img-1',
                        relevanceStrength: 'Definitely Relevant',
                        relevantPhrase: 'La Capella',
                    },
                    {
                        id: 'img-missing',
                        relevanceStrength: 'Maybe Relevant',
                        relevantPhrase: 'x',
                    },
                ],
            },
            input,
            pointItem,
        );

        expect(validated.betaSectionExcerpts).toHaveLength(1);
        expect(validated.images).toEqual([
            {
                id: 'img-1',
                relevanceStrength: 'Definitely Relevant',
                relevantPhrase: 'La Capella',
            },
        ]);
    });

    it('drops measurements that are invented or returned for non-line features', () => {
        const forPoint = validateLegendContext(
            {
                measurements: [
                    {
                        key: 'approachElevGain',
                        relevanceStrength: 'Maybe Relevant',
                    },
                ],
                betaSectionExcerpts: null,
                images: null,
            },
            input,
            pointItem,
        );
        expect(forPoint.measurements).toBeNull();

        const invented = validateLegendContext(
            {
                measurements: [
                    {
                        key: 'descentElevGain',
                        relevanceStrength: 'Maybe Relevant',
                    },
                ],
                betaSectionExcerpts: null,
                images: null,
            },
            input,
            lineItem,
        );
        expect(invented.measurements).toBeNull();

        const matching = validateLegendContext(
            {
                measurements: [
                    {
                        key: 'approachElevGain',
                        relevanceStrength: 'Definitely Relevant',
                    },
                ],
                betaSectionExcerpts: null,
                images: null,
            },
            input,
            lineItem,
        );
        expect(matching.measurements).toHaveLength(1);
    });

    it('clears relevantPhrase when not found in source fields but keeps the entries', () => {
        const validated = validateLegendContext(
            {
                measurements: null,
                betaSectionExcerpts: [
                    {
                        id: 'beta-1',
                        text: 'Then find your first bolted rap. Keep left.',
                        relevanceStrength: 'Somewhat Relevant',
                        relevantPhrase: 'not in source',
                    },
                ],
                images: [
                    {
                        id: 'img-1',
                        relevanceStrength: 'Definitely Relevant',
                        relevantPhrase: 'missing phrase',
                    },
                ],
            },
            input,
            pointItem,
        );
        expect(validated.betaSectionExcerpts).toEqual([
            {
                id: 'beta-1',
                text: 'Then find your first bolted rap. Keep left.',
                relevanceStrength: 'Somewhat Relevant',
            },
        ]);
        expect(validated.images).toEqual([
            {
                id: 'img-1',
                relevanceStrength: 'Definitely Relevant',
            },
        ]);
    });

    it('clears relevantPhrase when phrase is in title/body but missing from excerpt text', () => {
        const validated = validateLegendContext(
            {
                measurements: null,
                betaSectionExcerpts: [
                    {
                        id: 'beta-1',
                        text: 'Keep left.',
                        relevanceStrength: 'Somewhat Relevant',
                        relevantPhrase: 'first bolted rap',
                    },
                ],
                images: null,
            },
            input,
            pointItem,
        );
        expect(validated.betaSectionExcerpts).toEqual([
            {
                id: 'beta-1',
                text: 'Keep left.',
                relevanceStrength: 'Somewhat Relevant',
            },
        ]);
    });

    it('allows title-only excerpts when phrase is in the title', () => {
        const validated = validateLegendContext(
            {
                measurements: null,
                betaSectionExcerpts: [
                    {
                        id: 'beta-1',
                        text: null,
                        relevanceStrength: 'Somewhat Relevant',
                        relevantPhrase: 'Descent',
                    },
                ],
                images: null,
            },
            input,
            pointItem,
        );
        expect(validated.betaSectionExcerpts).toHaveLength(1);
    });
});
