import type { TokenUsage } from '../types/relevanceTypes';

export function addUsage(total: TokenUsage, next: TokenUsage): TokenUsage {
    return {
        inputTokens: total.inputTokens + next.inputTokens,
        outputTokens: total.outputTokens + next.outputTokens,
        totalTokens: total.totalTokens + next.totalTokens,
    };
}
