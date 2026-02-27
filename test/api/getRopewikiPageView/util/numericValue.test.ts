import { describe, it, expect } from '@jest/globals';
import numericValue from '../../../../src/api/getRopewikiPageView/util/numericValue';

describe('numericValue', () => {
    it('returns 0 when value is null', () => {
        expect(numericValue(null)).toBe(0);
    });

    it('returns 0 when value is undefined', () => {
        expect(numericValue(undefined)).toBe(0);
    });

    it('returns value when object has numeric value', () => {
        expect(numericValue({ value: 3.5 })).toBe(3.5);
        expect(numericValue({ value: 0 })).toBe(0);
        expect(numericValue({ value: 100, unit: 'ft' })).toBe(100);
    });

    it('returns 0 when object has no value property', () => {
        expect(numericValue({})).toBe(0);
        expect(numericValue({ unit: 'ft' })).toBe(0);
    });

    it('returns 0 when value is not a number', () => {
        expect(numericValue({ value: '10' })).toBe(0);
        expect(numericValue({ value: null })).toBe(0);
    });
});
