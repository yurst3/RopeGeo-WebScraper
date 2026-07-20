import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import getMapDataAuthors from '../../../src/map-data/util/getMapDataAuthors';
import { PageDataSource } from 'ropegeo-common/models';

jest.mock('../../../src/map-data/hook-functions/getRopewikiMapDataAuthors', () => ({
    __esModule: true,
    getRopewikiMapDataAuthors: jest.fn(),
    default: jest.fn(),
}));

describe('getMapDataAuthors', () => {
    let mockGetRopewikiMapDataAuthors: jest.MockedFunction<
        typeof import('../../../src/map-data/hook-functions/getRopewikiMapDataAuthors').getRopewikiMapDataAuthors
    >;

    beforeEach(() => {
        jest.clearAllMocks();
        const mod = require('../../../src/map-data/hook-functions/getRopewikiMapDataAuthors');
        mockGetRopewikiMapDataAuthors = mod.getRopewikiMapDataAuthors;
    });

    it('returns authors for Ropewiki source', async () => {
        mockGetRopewikiMapDataAuthors.mockResolvedValue(['Alice', 'Bob']);

        const authors = await getMapDataAuthors(
            PageDataSource.Ropewiki,
            'https://ropewiki.com/images/a/b/file.kml',
        );

        expect(mockGetRopewikiMapDataAuthors).toHaveBeenCalledWith(
            'https://ropewiki.com/images/a/b/file.kml',
        );
        expect(authors).toEqual(['Alice', 'Bob']);
    });

    it('returns null when Ropewiki lookup returns null', async () => {
        mockGetRopewikiMapDataAuthors.mockResolvedValue(null);

        const authors = await getMapDataAuthors(
            PageDataSource.Ropewiki,
            'https://ropewiki.com/luca/rwr?gpx=x',
        );

        expect(authors).toBeNull();
    });
});
