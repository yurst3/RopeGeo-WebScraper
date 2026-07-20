import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { getRopewikiMapDataAuthors } from '../../../src/map-data/hook-functions/getRopewikiMapDataAuthors';
import getContributors from '../../../src/ropewiki/http/getContributors';

jest.mock('../../../src/ropewiki/http/getContributors', () => {
    const fn = jest.fn();
    return {
        __esModule: true,
        default: fn,
        getContributors: fn,
    };
});

const mockGetContributors = getContributors as jest.MockedFunction<
    typeof getContributors
>;

describe('getRopewikiMapDataAuthors', () => {
    afterEach(() => {
        mockGetContributors.mockReset();
    });

    it('returns null for Luca/proxy URLs without calling MediaWiki', async () => {
        const authors = await getRopewikiMapDataAuthors(
            'https://ropewiki.com/luca/rwr?gpx%3Doff&filename%3DAmarron&ext%3D.kml',
        );
        expect(authors).toBeNull();
        expect(mockGetContributors).not.toHaveBeenCalled();
    });

    it('fetches contributors for /images/*/*/*.kml URLs', async () => {
        mockGetContributors.mockResolvedValue({
            'File:Amaro.kml': ['Bjp'],
        });
        const authors = await getRopewikiMapDataAuthors(
            'https://ropewiki.com/images/1/11/Amaro.kml',
        );
        expect(mockGetContributors).toHaveBeenCalledWith(['File:Amaro.kml']);
        expect(authors).toEqual(['Bjp']);
    });

    it('returns null when File page is missing from contributors response', async () => {
        mockGetContributors.mockResolvedValue({});
        const authors = await getRopewikiMapDataAuthors(
            'https://ropewiki.com/images/1/11/Missing.kml',
        );
        expect(authors).toBeNull();
    });

    it('returns null and logs when getContributors throws', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockGetContributors.mockRejectedValue(new Error('network down'));

        const authors = await getRopewikiMapDataAuthors(
            'https://ropewiki.com/images/1/11/Amaro.kml',
        );

        expect(authors).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('getRopewikiMapDataAuthors failed'),
        );
        consoleSpy.mockRestore();
    });
});
