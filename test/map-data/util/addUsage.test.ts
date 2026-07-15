import { describe, it, expect } from '@jest/globals';
import { addUsage } from '../../../src/map-data/util/addUsage';

describe('addUsage', () => {
    it('sums token usage fields', () => {
        expect(
            addUsage(
                { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
            ),
        ).toEqual({ inputTokens: 11, outputTokens: 22, totalTokens: 33 });
    });

    it('handles zero usage', () => {
        const zero = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
        expect(addUsage(zero, { inputTokens: 5, outputTokens: 7, totalTokens: 12 })).toEqual({
            inputTokens: 5,
            outputTokens: 7,
            totalTokens: 12,
        });
    });
});
