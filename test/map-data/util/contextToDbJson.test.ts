import { describe, it, expect } from '@jest/globals';
import { contextToDbJson, hasRelevantContextContent } from '../../../src/map-data/util/contextToDbJson';
import type { Context } from '../../../src/map-data/util/legendContextSchema';

describe('contextToDbJson', () => {
    it('groups beta section excerpts and images by id with empty string for null betaSectionId', () => {
        const context: Context = {
            measurements: [
                { label: 'exitElevGain', value: 490, unitName: 'feet', confidence: 0.95 },
                { label: 'shuttleTime', value: 20, unitName: 'minutes', confidence: 0.7 },
            ],
            betaSectionExcerpts: [
                { id: 'beta-exit', text: 'Exit hike', confidence: 0.9 },
                { id: 'beta-exit', text: null, confidence: 0.5 },
            ],
            images: [
                { id: 'img-1', betaSectionId: null, confidence: 0.85 },
                { id: 'img-2', betaSectionId: 'beta-descent', confidence: 0.99 },
            ],
        };

        const dbJson = contextToDbJson(context);

        expect(dbJson.measurements).toHaveLength(2);
        expect(dbJson.measurements![0]).toMatchObject({
            label: 'exitElevGain',
            confidence: 0.95,
        });
        expect(dbJson.measurements![0]!.measurement).toMatchObject({
            measurementType: 'length',
            value: 490,
        });
        expect(dbJson.measurements![1]!.measurement).toMatchObject({
            measurementType: 'time',
            value: 20,
        });

        expect(dbJson.betaSectionExcerpts).toEqual({
            'beta-exit': [
                { text: 'Exit hike', confidence: 0.9 },
                { confidence: 0.5 },
            ],
        });

        expect(dbJson.images).toEqual({
            '': [{ id: 'img-1', confidence: 0.85 }],
            'beta-descent': [{ id: 'img-2', confidence: 0.99 }],
        });
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
                images: [{ id: 'img-1', betaSectionId: null, confidence: 0.5 }],
            }),
        ).toBe(true);
    });
});
