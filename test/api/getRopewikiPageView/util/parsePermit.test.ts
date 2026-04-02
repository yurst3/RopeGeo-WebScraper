import { describe, it, expect } from '@jest/globals';
import { PermitStatus } from 'ropegeo-common/classes';
import parsePermit from '../../../../src/api/getRopewikiPageView/util/parsePermit';

describe('parsePermit', () => {
    it('returns null when permits is null', () => {
        expect(parsePermit(null)).toBeNull();
    });

    it('returns null when permits is empty string', () => {
        expect(parsePermit('')).toBeNull();
    });

    it('returns PermitStatus for valid values', () => {
        expect(parsePermit('Yes')).toBe(PermitStatus.Yes);
        expect(parsePermit('No')).toBe(PermitStatus.No);
        expect(parsePermit('Restricted')).toBe(PermitStatus.Restricted);
        expect(parsePermit('Closed')).toBe(PermitStatus.Closed);
    });

    it('trims whitespace before matching', () => {
        expect(parsePermit('  Yes  ')).toBe(PermitStatus.Yes);
        expect(parsePermit('\tNo\n')).toBe(PermitStatus.No);
    });

    it('returns null for unknown value', () => {
        expect(parsePermit('Maybe')).toBeNull();
        expect(parsePermit('Requires permit')).toBeNull();
    });
});
