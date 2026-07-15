import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { getRelevanceModelMaxAttempts } from '../../../src/map-data/util/getRelevanceModelMaxAttempts';

describe('getRelevanceModelMaxAttempts', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('returns the configured max attempts', () => {
        process.env.MAP_DATA_RELEVANCE_MODEL_MAX_ATTEMPTS = '3';
        expect(getRelevanceModelMaxAttempts()).toBe(3);
    });

    it('throws when unset', () => {
        delete process.env.MAP_DATA_RELEVANCE_MODEL_MAX_ATTEMPTS;
        expect(() => getRelevanceModelMaxAttempts()).toThrow(
            'MAP_DATA_RELEVANCE_MODEL_MAX_ATTEMPTS environment variable is not set',
        );
    });

    it('throws when less than 1', () => {
        process.env.MAP_DATA_RELEVANCE_MODEL_MAX_ATTEMPTS = '0';
        expect(() => getRelevanceModelMaxAttempts()).toThrow(/must be an integer >= 1/);
    });
});
