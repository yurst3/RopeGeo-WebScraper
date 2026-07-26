import { describe, it, expect } from '@jest/globals';
import { contextToDbJson, hasRelevantContextContent } from '../../../src/map-data/util/contextToDbJson';
import type { Context } from '../../../src/map-data/util/legendContextSchema';

describe('contextToDbJson', () => {
    it('emits flat images and groups text excerpts by id', () => {
        const context: Context = {
            measurements: [
                {
                    key: 'exitElevGain',
                    relevanceStrength: 'Definitely Relevant',
                },
                {
                    key: 'shuttleTime',
                    relevanceStrength: 'Somewhat Relevant',
                },
            ],
            betaSectionExcerpts: [
                {
                    id: 'beta-exit',
                    text: 'Exit hike',
                    relevanceStrength: 'Somewhat Relevant',
                    relevantPhrase: 'Exit',
                },
                {
                    id: 'beta-exit',
                    text: null,
                    relevanceStrength: 'Maybe Relevant',
                    relevantPhrase: 'Exit',
                },
            ],
            images: [
                {
                    id: 'img-1',
                    relevanceStrength: 'Somewhat Relevant',
                    relevantPhrase: 'banner',
                },
                {
                    id: 'img-2',
                    relevanceStrength: 'Definitely Relevant',
                    relevantPhrase: 'rappel',
                },
            ],
        };

        const dbJson = contextToDbJson(context);

        expect(dbJson.measurements).toEqual([
            { key: 'exitElevGain', relevanceStrength: 'Definitely Relevant' },
            { key: 'shuttleTime', relevanceStrength: 'Somewhat Relevant' },
        ]);

        expect(dbJson.betaSectionExcerpts).toEqual({
            'beta-exit': [
                {
                    text: 'Exit hike',
                    relevanceStrength: 'Somewhat Relevant',
                    relevantPhrase: 'Exit',
                },
                {
                    relevanceStrength: 'Maybe Relevant',
                    relevantPhrase: 'Exit',
                },
            ],
        });

        expect(dbJson.images).toEqual([
            {
                id: 'img-1',
                relevanceStrength: 'Somewhat Relevant',
                relevantPhrase: 'banner',
            },
            {
                id: 'img-2',
                relevanceStrength: 'Definitely Relevant',
                relevantPhrase: 'rappel',
            },
        ]);
    });

    it('omits relevantPhrase from DB JSON when cleared', () => {
        const dbJson = contextToDbJson({
            measurements: null,
            betaSectionExcerpts: [
                {
                    id: 'beta-1',
                    text: 'Keep left.',
                    relevanceStrength: 'Somewhat Relevant',
                },
            ],
            images: [
                {
                    id: 'img-1',
                    relevanceStrength: 'Maybe Relevant',
                },
            ],
        });
        expect(dbJson.betaSectionExcerpts).toEqual({
            'beta-1': [{ text: 'Keep left.', relevanceStrength: 'Somewhat Relevant' }],
        });
        expect(dbJson.images).toEqual([
            { id: 'img-1', relevanceStrength: 'Maybe Relevant' },
        ]);
    });

    it('returns null collections when model abstains entirely', () => {
        const dbJson = contextToDbJson({
            measurements: null,
            betaSectionExcerpts: null,
            images: null,
        });
        expect(dbJson).toEqual({
            measurements: null,
            betaSectionExcerpts: null,
            images: null,
        });
    });
});

describe('hasRelevantContextContent', () => {
    it('is false when all collections are empty or null', () => {
        expect(
            hasRelevantContextContent({
                measurements: null,
                betaSectionExcerpts: [],
                images: null,
            }),
        ).toBe(false);
    });

    it('is true when any collection has entries', () => {
        expect(
            hasRelevantContextContent({
                measurements: null,
                betaSectionExcerpts: null,
                images: [
                    {
                        id: 'img-1',
                        relevanceStrength: 'Maybe Relevant',
                        relevantPhrase: 'x',
                    },
                ],
            }),
        ).toBe(true);
    });
});
