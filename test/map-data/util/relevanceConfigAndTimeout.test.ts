import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { getRelevanceProcessorTimeoutMs } from '../../../src/map-data/util/getRelevanceProcessorTimeoutMs';
import { estimateCostUsd, loadModelConfigFromEnv } from '../../../src/map-data/util/loadRelevanceConfig';

describe('getRelevanceProcessorTimeoutMs', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('returns timeout in milliseconds', () => {
        process.env.MAP_DATA_RELEVANCE_PROCESSOR_TIMEOUT_SECONDS = '900';
        expect(getRelevanceProcessorTimeoutMs()).toBe(900_000);
    });

    it('throws when unset or invalid', () => {
        delete process.env.MAP_DATA_RELEVANCE_PROCESSOR_TIMEOUT_SECONDS;
        expect(() => getRelevanceProcessorTimeoutMs()).toThrow(
            /Invalid MAP_DATA_RELEVANCE_PROCESSOR_TIMEOUT_SECONDS/,
        );
    });
});

describe('loadRelevanceConfig', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('loads model config from env', () => {
        process.env.MAP_DATA_RELEVANCE_GATEWAY_MODEL = 'deepseek/test';
        process.env.MAP_DATA_RELEVANCE_INPUT_PRICE_PER_MILLION = '0.14';
        process.env.MAP_DATA_RELEVANCE_OUTPUT_PRICE_PER_MILLION = '0.28';

        expect(loadModelConfigFromEnv()).toEqual({
            gatewayModel: 'deepseek/test',
            inputPricePerMillion: 0.14,
            outputPricePerMillion: 0.28,
        });
    });

    it('loads the default system prompt', () => {
        const { loadSystemPrompt } = require('../../../src/map-data/util/loadRelevanceConfig') as typeof import('../../../src/map-data/util/loadRelevanceConfig');
        const prompt = loadSystemPrompt();
        expect(prompt.length).toBeGreaterThan(100);
        expect(prompt).toContain('legend item');
    });

    it('estimates cost from token usage', () => {
        const cost = estimateCostUsd(
            { inputTokens: 1_000_000, outputTokens: 1_000_000 },
            { gatewayModel: 'x', inputPricePerMillion: 1, outputPricePerMillion: 2 },
        );
        expect(cost).toBe(3);
    });
});
