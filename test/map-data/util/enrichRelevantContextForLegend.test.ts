import { describe, it, expect } from '@jest/globals';
import {
    Bounds,
    LineLegendItem,
    OnlineBetaSection,
    PointLegendItem,
    RelevantContext,
    BetaSectionExcerpt,
} from 'ropegeo-common/models';
import {
    attachRelevantContextToLegendRecord,
    enrichRelevantContextExcerpts,
} from '../../../src/map-data/util/enrichRelevantContextForLegend';

describe('enrichRelevantContextForLegend', () => {
    it('replaces excerpt text with API-time offsets via toExcerpt when section text matches', () => {
        const section = new OnlineBetaSection(0, 'Descent', 'Before R1 After', new Date('2025-01-01'));
        const context = new RelevantContext(
            [],
            {
                b1: [new BetaSectionExcerpt('R1', undefined, undefined, 0.9)],
            },
            {},
        );

        const enriched = enrichRelevantContextExcerpts(
            context,
            new Map([['b1', section]]),
        );

        expect(enriched.betaSectionExcerpts.b1![0]!.text).toBe('R1');
        expect(enriched.betaSectionExcerpts.b1![0]!.start).toBe(7);
        expect(enriched.betaSectionExcerpts.b1![0]!.end).toBe(9);
    });

    it('attaches enriched context onto matching legend items', () => {
        const bounds = new Bounds(40, 39, -110, -111);
        const legend = {
            m1: new PointLegendItem('m1', 'TH', { lat: 40, lon: -111 }),
            s1: new LineLegendItem('s1', 'Trail', bounds),
        };
        const context = new RelevantContext([], {}, {});
        const out = attachRelevantContextToLegendRecord(
            legend,
            new Map([['m1', context]]),
            new Map(),
        );

        expect(out.m1!.relevantContext).toBeInstanceOf(RelevantContext);
        expect(out.s1!.relevantContext).toBeNull();
    });
});
