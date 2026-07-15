import { describe, it, expect } from '@jest/globals';
import { errorToMessage } from '../../../src/map-data/util/errorToMessage';

describe('errorToMessage', () => {
    it('returns Error.message for Error instances', () => {
        expect(errorToMessage(new Error('boom'))).toBe('boom');
    });

    it('stringifies non-Error values', () => {
        expect(errorToMessage('plain')).toBe('plain');
        expect(errorToMessage(42)).toBe('42');
        expect(errorToMessage(null)).toBe('null');
    });
});
