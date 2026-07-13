import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { getRelevanceErrorRetryVisibilityTimeoutSeconds } from '../../../src/map-data/util/getRelevanceErrorRetryVisibilityTimeoutSeconds';

describe('getRelevanceErrorRetryVisibilityTimeoutSeconds', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('returns the configured timeout', () => {
        process.env.MAP_DATA_RELEVANCE_ERROR_RETRY_VISIBILITY_TIMEOUT_SECONDS = '21600';
        expect(getRelevanceErrorRetryVisibilityTimeoutSeconds()).toBe(21600);
    });

    it('throws when unset', () => {
        delete process.env.MAP_DATA_RELEVANCE_ERROR_RETRY_VISIBILITY_TIMEOUT_SECONDS;
        expect(() => getRelevanceErrorRetryVisibilityTimeoutSeconds()).toThrow(
            'MAP_DATA_RELEVANCE_ERROR_RETRY_VISIBILITY_TIMEOUT_SECONDS environment variable is not set',
        );
    });

    it('throws when out of SQS range', () => {
        process.env.MAP_DATA_RELEVANCE_ERROR_RETRY_VISIBILITY_TIMEOUT_SECONDS = '99999';
        expect(() => getRelevanceErrorRetryVisibilityTimeoutSeconds()).toThrow(
            /must be between 0 and 43200/,
        );
    });
});
