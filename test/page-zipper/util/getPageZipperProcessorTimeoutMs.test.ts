import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { getPageZipperProcessorTimeoutMs } from '../../../src/page-zipper/util/getPageZipperProcessorTimeoutMs';

describe('getPageZipperProcessorTimeoutMs', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('returns milliseconds for a positive timeout', () => {
        process.env.PAGE_ZIPPER_PROCESSOR_TIMEOUT_SECONDS = '900';
        expect(getPageZipperProcessorTimeoutMs()).toBe(900_000);
    });

    it('throws when env is missing or invalid', () => {
        delete process.env.PAGE_ZIPPER_PROCESSOR_TIMEOUT_SECONDS;
        expect(() => getPageZipperProcessorTimeoutMs()).toThrow(
            /Invalid PAGE_ZIPPER_PROCESSOR_TIMEOUT_SECONDS/,
        );

        process.env.PAGE_ZIPPER_PROCESSOR_TIMEOUT_SECONDS = '0';
        expect(() => getPageZipperProcessorTimeoutMs()).toThrow(
            /Invalid PAGE_ZIPPER_PROCESSOR_TIMEOUT_SECONDS/,
        );

        process.env.PAGE_ZIPPER_PROCESSOR_TIMEOUT_SECONDS = 'bad';
        expect(() => getPageZipperProcessorTimeoutMs()).toThrow(
            /Invalid PAGE_ZIPPER_PROCESSOR_TIMEOUT_SECONDS/,
        );
    });
});
