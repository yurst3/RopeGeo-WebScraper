import { describe, it, expect } from '@jest/globals';
import {
    coordinatesKey,
    pagePopularity,
    pickMostPopularPage,
} from '../../../src/ropewiki/util/pagePopularity';

describe('pagePopularity', () => {
    it('multiplies quality by userVotes', () => {
        expect(pagePopularity({ quality: 4, userVotes: 10 })).toBe(40);
    });

    it('treats missing quality or userVotes as 0', () => {
        expect(pagePopularity({ quality: 5 })).toBe(0);
        expect(pagePopularity({ userVotes: 12 })).toBe(0);
        expect(pagePopularity({})).toBe(0);
        expect(pagePopularity({ quality: null, userVotes: null })).toBe(0);
    });
});

describe('pickMostPopularPage', () => {
    it('returns the page with the highest popularity', () => {
        const pages = [
            { name: 'A', quality: 2, userVotes: 5 },
            { name: 'B', quality: 5, userVotes: 10 },
            { name: 'C', quality: 4, userVotes: 3 },
        ];
        expect(pickMostPopularPage(pages).name).toBe('B');
    });

    it('keeps the first page when popularity ties', () => {
        const pages = [
            { name: 'First', quality: 2, userVotes: 5 },
            { name: 'Second', quality: 5, userVotes: 2 },
            { name: 'Third', quality: 1, userVotes: 10 },
        ];
        expect(pickMostPopularPage(pages).name).toBe('First');
    });

    it('throws when given an empty list', () => {
        expect(() => pickMostPopularPage([])).toThrow('pickMostPopularPage requires at least one page');
    });
});

describe('coordinatesKey', () => {
    it('builds a stable lat,lon key', () => {
        expect(coordinatesKey({ lat: 40.1, lon: -111.5 })).toBe('40.1,-111.5');
    });
});
