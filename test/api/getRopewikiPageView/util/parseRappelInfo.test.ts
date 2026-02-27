import { describe, it, expect } from '@jest/globals';
import parseRappelInfo from '../../../../src/api/getRopewikiPageView/util/parseRappelInfo';

describe('parseRappelInfo', () => {
    it('returns null rappelCount and null jumps when rappelInfo is null', () => {
        expect(parseRappelInfo(null, null)).toEqual({ rappelCount: null, jumps: null });
    });

    it('returns null rappelCount and null jumps when rappelInfo is empty string', () => {
        expect(parseRappelInfo('', null)).toEqual({ rappelCount: null, jumps: null });
    });

    it('parses single rappel count "<n>r"', () => {
        expect(parseRappelInfo('5r', null)).toEqual({ rappelCount: 5, jumps: null });
        expect(parseRappelInfo('1r', null)).toEqual({ rappelCount: 1, jumps: null });
    });

    it('parses range "<min>-<max>r"', () => {
        expect(parseRappelInfo('4-6r', null)).toEqual({
            rappelCount: { min: 4, max: 6 },
            jumps: null,
        });
    });

    it('parses "+j" as one jump', () => {
        expect(parseRappelInfo('5r+j', null)).toEqual({ rappelCount: 5, jumps: 1 });
    });

    it('parses "+<n>j" as n jumps', () => {
        expect(parseRappelInfo('5r+2j', null)).toEqual({ rappelCount: 5, jumps: 2 });
        expect(parseRappelInfo('4-6r+2j', null)).toEqual({
            rappelCount: { min: 4, max: 6 },
            jumps: 2,
        });
    });

    it('trims rappelInfo before parsing', () => {
        expect(parseRappelInfo('  5r  ', null)).toEqual({ rappelCount: 5, jumps: null });
    });

    it('falls back to dbRappelCount when rappelInfo has no rappel pattern', () => {
        expect(parseRappelInfo(null, 3)).toEqual({ rappelCount: 3, jumps: null });
        expect(parseRappelInfo('', 7)).toEqual({ rappelCount: 7, jumps: null });
    });

    it('does not use dbRappelCount when rappelInfo parses to a count', () => {
        expect(parseRappelInfo('5r', 99)).toEqual({ rappelCount: 5, jumps: null });
    });
});
