import { describe, it, expect } from '@jest/globals';
import type { RopewikiPageView } from 'ropegeo-common';
import { Difficulty } from 'ropegeo-common';
import {
    buildLinkPreviewFromPageView,
    formatDifficultyForLinkPreview,
} from '../../../../src/api/getRopewikiPageLinkPreview/util/pageViewToLinkPreview';

function baseView(overrides: Partial<RopewikiPageView> = {}): RopewikiPageView {
    const difficulty = new Difficulty('3', 'A', 'II', null);
    return {
        name: 'X',
        aka: [],
        url: 'https://ropewiki.com/X',
        quality: 1,
        userVotes: 0,
        difficulty,
        permit: null,
        rappelCount: null,
        jumps: null,
        vehicle: null,
        rappelLongest: null,
        shuttleTime: null,
        overallLength: null,
        descentLength: null,
        exitLength: null,
        approachLength: null,
        overallTime: null,
        approachTime: null,
        descentTime: null,
        exitTime: null,
        approachElevGain: null,
        descentElevGain: null,
        exitElevGain: null,
        months: [],
        latestRevisionDate: new Date(),
        regions: [],
        bannerImage: null,
        betaSections: [],
        miniMap: null,
        ...overrides,
    } as RopewikiPageView;
}

describe('pageViewToLinkPreview', () => {
    describe('formatDifficultyForLinkPreview', () => {
        it('joins technical water time and risk', () => {
            const d = new Difficulty('3', 'A', 'II', 'PG13');
            const v = baseView({ difficulty: d });
            expect(formatDifficultyForLinkPreview(v)).toBe('3A II PG13');
        });
    });

    describe('buildLinkPreviewFromPageView', () => {
        it('formats title with AKA', () => {
            const lp = buildLinkPreviewFromPageView(
                baseView({ name: 'Cassidy', aka: ['A', 'B'] }),
                null,
            );
            expect(lp.title).toBe('Cassidy AKA A, B');
        });

        it('uses name only when no aka', () => {
            const lp = buildLinkPreviewFromPageView(baseView({ name: 'Solo' }), null);
            expect(lp.title).toBe('Solo');
        });

        it('uses empty dimension strings when metadata missing', () => {
            const v = baseView({
                bannerImage: {
                    order: 0,
                    id: '550e8400-e29b-41d4-a716-446655440000',
                    bannerUrl: 'https://x/y.avif',
                    fullUrl: null,
                    linkUrl: 'https://ropewiki.com/l',
                    caption: null,
                    latestRevisionDate: new Date(),
                    downloadBytes: null,
                } as RopewikiPageView['bannerImage'],
            });
            const lp = buildLinkPreviewFromPageView(v, null);
            expect(lp.image?.url).toBe('https://x/y.avif');
            expect(lp.image?.width).toBe('');
            expect(lp.image?.height).toBe('');
            expect(lp.image?.type).toBe('image/avif');
        });

        it('prefers linkPreviewUrl and JPEG metadata when present', () => {
            const v = baseView({
                bannerImage: {
                    order: 0,
                    id: '550e8400-e29b-41d4-a716-446655440000',
                    bannerUrl: 'https://x/banner.avif',
                    fullUrl: null,
                    linkUrl: 'https://ropewiki.com/l',
                    caption: null,
                    latestRevisionDate: new Date(),
                    downloadBytes: null,
                } as RopewikiPageView['bannerImage'],
            });
            const lp = buildLinkPreviewFromPageView(v, {
                metadata: {
                    linkPreview: {
                        sizeKB: 2,
                        dimensions: { width: 256, height: 200 },
                        orientation: 1,
                        mimeType: 'image/jpeg',
                    },
                    banner: {
                        sizeKB: 10,
                        dimensions: { width: 800, height: 400 },
                        orientation: 1,
                    },
                },
                linkPreviewUrl: 'https://x/link.jpg',
            });
            expect(lp.image?.url).toBe('https://x/link.jpg');
            expect(lp.image?.type).toBe('image/jpeg');
            expect(lp.image?.width).toBe('256');
            expect(lp.image?.height).toBe('200');
        });
    });
});
