import { describe, it, expect } from '@jest/globals';
import {
    formatPageRelevancePayload,
    formatPageRelevanceUserPrompt,
} from '../../../src/map-data/util/formatPageRelevancePayload';
import type { PageRelevanceInput } from '../../../src/map-data/types/relevanceTypes';

describe('formatPageRelevancePayload', () => {
    const input: PageRelevanceInput = {
        page: { id: 'p1', name: 'Page', url: 'https://example.com' },
        mapDataId: 'm1',
        legendItems: [],
        betaSections: [{ id: 'b1', title: 'Descent', text: 'R1 is 20ft', order: 0 }],
        images: [
            {
                id: 'img-1',
                betaSectionId: 'b1',
                betaSectionTitle: 'Descent',
                caption: 'Rappel photo',
                order: 0,
            },
            {
                id: 'img-2',
                betaSectionId: null,
                betaSectionTitle: null,
                caption: '   ',
                order: 1,
            },
        ],
        pageStats: {
            approachLength: { value: 1, unitName: 'miles' },
            descentLength: null,
            shuttleTime: '',
        },
    };

    it('includes pageStats only for line legend items and filters uncaptioned images', () => {
        const linePayload = formatPageRelevancePayload(input, {
            id: 'l1',
            featureType: 'line',
            name: 'Trail',
        });
        expect(linePayload.pageStats).toEqual({
            approachLength: { value: 1, unitName: 'miles' },
        });
        expect(linePayload.images).toEqual([
            { id: 'img-1', caption: 'Rappel photo', betaSectionTitle: 'Descent' },
        ]);

        const pointPayload = formatPageRelevancePayload(input, {
            id: 'p1',
            featureType: 'point',
            name: 'Trailhead',
        });
        expect(pointPayload.pageStats).toBeUndefined();
    });

    it('builds a user prompt containing the legend name and JSON payload', () => {
        const prompt = formatPageRelevanceUserPrompt(input, {
            id: 'l1',
            featureType: 'line',
            name: 'Trail',
        });
        expect(prompt).toContain('legend item "Trail"');
        expect(prompt).toContain('"pageName": "Page"');
    });
});
