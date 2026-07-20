import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ProgressLogger } from 'ropegeo-common/helpers';
import { processPageAndImageAuthors } from '../../../src/ropewiki/processors/processPageAndImageAuthors';
import getContributors from '../../../src/ropewiki/http/getContributors';
import updateRopewikiPageAuthors from '../../../src/ropewiki/database/updateRopewikiPageAuthors';
import updateRopewikiImageAuthors from '../../../src/ropewiki/database/updateRopewikiImageAuthors';
import { RopewikiImage } from '../../../src/ropewiki/types/image';

jest.mock('../../../src/ropewiki/http/getContributors');
jest.mock('../../../src/ropewiki/database/updateRopewikiPageAuthors');
jest.mock('../../../src/ropewiki/database/updateRopewikiImageAuthors');

const mockGetContributors = getContributors as jest.MockedFunction<typeof getContributors>;
const mockUpdatePageAuthors = updateRopewikiPageAuthors as jest.MockedFunction<
    typeof updateRopewikiPageAuthors
>;
const mockUpdateImageAuthors = updateRopewikiImageAuthors as jest.MockedFunction<
    typeof updateRopewikiImageAuthors
>;

describe('processPageAndImageAuthors', () => {
    const conn = {} as never;
    const page = {
        id: 'page-1',
        url: 'https://ropewiki.com/The_Subway',
        externalPageId: '728',
        name: 'The Subway',
    };
    let logger: { logError: jest.Mock };

    beforeEach(() => {
        jest.clearAllMocks();
        logger = { logError: jest.fn() };
        mockUpdatePageAuthors.mockResolvedValue(undefined);
        mockUpdateImageAuthors.mockResolvedValue(undefined);
    });

    it('fetches contributors and writes page and image authors', async () => {
        const img = new RopewikiImage(
            undefined,
            'https://ropewiki.com/File:Banner.jpg',
            'https://ropewiki.com/images/b/banner.jpg',
            undefined,
            1,
        );
        img.id = 'img-1';
        const kml = new RopewikiImage(
            undefined,
            'https://ropewiki.com/File:Map.kml',
            'https://ropewiki.com/images/m/map.kml',
            undefined,
            2,
        );
        kml.id = 'img-2';

        mockGetContributors.mockResolvedValue({
            The_Subway: ['Alice'],
            'File:Banner.jpg': ['Bob'],
        });

        await processPageAndImageAuthors(
            conn,
            page,
            [img, kml],
            logger as unknown as ProgressLogger,
        );

        expect(mockGetContributors).toHaveBeenCalledWith([
            'The_Subway',
            'File:Banner.jpg',
        ]);
        expect(mockUpdatePageAuthors).toHaveBeenCalledWith(conn, 'page-1', ['Alice']);
        expect(mockUpdateImageAuthors).toHaveBeenCalledWith(conn, [
            { id: 'img-1', authors: ['Bob'] },
            { id: 'img-2', authors: null },
        ]);
        expect(logger.logError).not.toHaveBeenCalled();
    });

    it('skips images without ids', async () => {
        const withId = new RopewikiImage(
            undefined,
            'https://ropewiki.com/File:A.jpg',
            'https://ropewiki.com/images/a.jpg',
            undefined,
            1,
        );
        withId.id = 'img-1';
        const withoutId = new RopewikiImage(
            undefined,
            'https://ropewiki.com/File:B.jpg',
            'https://ropewiki.com/images/b.jpg',
            undefined,
            2,
        );

        mockGetContributors.mockResolvedValue({
            The_Subway: ['Alice'],
            'File:A.jpg': ['Bob'],
        });

        await processPageAndImageAuthors(
            conn,
            page,
            [withId, withoutId],
            logger as unknown as ProgressLogger,
        );

        expect(mockGetContributors).toHaveBeenCalledWith(['The_Subway', 'File:A.jpg']);
        expect(mockUpdateImageAuthors).toHaveBeenCalledWith(conn, [
            { id: 'img-1', authors: ['Bob'] },
        ]);
    });

    it('logs and clears authors when contributors fetch fails', async () => {
        const img = new RopewikiImage(
            undefined,
            'https://ropewiki.com/File:Banner.jpg',
            'https://ropewiki.com/images/b/banner.jpg',
            undefined,
            1,
        );
        img.id = 'img-1';
        mockGetContributors.mockRejectedValue(new Error('api down'));

        await processPageAndImageAuthors(
            conn,
            page,
            [img],
            logger as unknown as ProgressLogger,
        );

        expect(logger.logError).toHaveBeenCalledWith(
            expect.stringContaining('Attribution fetch failed for page 728 The Subway'),
        );
        expect(mockUpdatePageAuthors).toHaveBeenCalledWith(conn, 'page-1', null);
        expect(mockUpdateImageAuthors).toHaveBeenCalledWith(conn, [
            { id: 'img-1', authors: null },
        ]);
    });
});
