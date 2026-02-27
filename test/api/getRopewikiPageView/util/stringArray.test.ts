import { describe, it, expect } from '@jest/globals';
import stringArray from '../../../../src/api/getRopewikiPageView/util/stringArray';

describe('stringArray', () => {
    it('returns empty array when value is null', () => {
        expect(stringArray(null)).toEqual([]);
    });

    it('returns empty array when value is undefined', () => {
        expect(stringArray(undefined)).toEqual([]);
    });

    it('returns string array when value is array of strings', () => {
        expect(stringArray(['a', 'b'])).toEqual(['a', 'b']);
        expect(stringArray(['Jun', 'Jul', 'Aug'])).toEqual(['Jun', 'Jul', 'Aug']);
    });

    it('filters out non-strings', () => {
        expect(stringArray(['a', 1, 'b', null, 'c'])).toEqual(['a', 'b', 'c']);
    });

    it('returns empty array when value is not an array', () => {
        expect(stringArray({})).toEqual([]);
        expect(stringArray('hello')).toEqual([]);
        expect(stringArray(42)).toEqual([]);
    });
});
