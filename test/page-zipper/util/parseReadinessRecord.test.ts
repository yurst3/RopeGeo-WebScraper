import { describe, it, expect } from '@jest/globals';
import { parseReadinessRecord } from '../../../src/page-zipper/util/parseReadinessRecord';

describe('parseReadinessRecord', () => {
    it('returns null for nullish values', () => {
        expect(parseReadinessRecord(null)).toBeNull();
        expect(parseReadinessRecord(undefined)).toBeNull();
    });

    it('returns null for non-objects and arrays', () => {
        expect(parseReadinessRecord('x')).toBeNull();
        expect(parseReadinessRecord(1)).toBeNull();
        expect(parseReadinessRecord([true])).toBeNull();
    });

    it('returns null when any entry is not a boolean', () => {
        expect(parseReadinessRecord({ a: true, b: 'no' })).toBeNull();
    });

    it('returns an empty object for {}', () => {
        expect(parseReadinessRecord({})).toEqual({});
    });

    it('returns a boolean record for valid maps', () => {
        expect(parseReadinessRecord({ a: true, b: false })).toEqual({ a: true, b: false });
    });
});
