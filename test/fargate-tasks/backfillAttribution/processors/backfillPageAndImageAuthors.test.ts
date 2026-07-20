import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../../../../src/fargate-tasks/backfillAttribution/database/getPagesNeedingAuthors', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../../src/fargate-tasks/backfillAttribution/database/getImagesNeedingAuthors', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../../src/fargate-tasks/backfillAttribution/database/getPagesByIds', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../../src/ropewiki/http/getContributors', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../../src/ropewiki/database/updateRopewikiPageAuthors', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../../src/ropewiki/database/updateRopewikiImageAuthors', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../../src/fargate-tasks/backfillAttribution/util/sleep', () => ({
    __esModule: true,
    default: jest.fn(() => Promise.resolve()),
    sleep: jest.fn(() => Promise.resolve()),
}));

import { backfillPageAndImageAuthors } from '../../../../src/fargate-tasks/backfillAttribution/processors/backfillPageAndImageAuthors';
import getPagesNeedingAuthors from '../../../../src/fargate-tasks/backfillAttribution/database/getPagesNeedingAuthors';
import getImagesNeedingAuthors from '../../../../src/fargate-tasks/backfillAttribution/database/getImagesNeedingAuthors';
import getPagesByIds from '../../../../src/fargate-tasks/backfillAttribution/database/getPagesByIds';
import getContributors from '../../../../src/ropewiki/http/getContributors';
import updateRopewikiPageAuthors from '../../../../src/ropewiki/database/updateRopewikiPageAuthors';
import updateRopewikiImageAuthors from '../../../../src/ropewiki/database/updateRopewikiImageAuthors';

describe('backfillPageAndImageAuthors', () => {
    const conn = {} as never;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(getPagesByIds).mockResolvedValue([]);
        jest.mocked(updateRopewikiPageAuthors).mockResolvedValue(undefined);
        jest.mocked(updateRopewikiImageAuthors).mockResolvedValue(undefined);
    });

    it('fetches contributors and updates page and image authors', async () => {
        jest.mocked(getPagesNeedingAuthors).mockResolvedValue([
            { id: 'page-1', url: 'https://ropewiki.com/Canyon' },
        ]);
        jest.mocked(getImagesNeedingAuthors).mockResolvedValue([
            {
                id: 'img-1',
                ropewikiPage: 'page-1',
                linkUrl: 'https://ropewiki.com/File:Pic.jpg',
            },
        ]);
        jest.mocked(getContributors).mockResolvedValue({
            Canyon: ['Alice'],
            'File:Pic.jpg': ['Bob'],
        });

        const summary = await backfillPageAndImageAuthors(conn);

        expect(getContributors).toHaveBeenCalledWith(['Canyon', 'File:Pic.jpg']);
        expect(updateRopewikiPageAuthors).toHaveBeenCalledWith(conn, 'page-1', ['Alice']);
        expect(updateRopewikiImageAuthors).toHaveBeenCalledWith(conn, [
            { id: 'img-1', authors: ['Bob'] },
        ]);
        expect(summary).toEqual({
            pagesAttempted: 1,
            pagesUpdated: 1,
            imagesAttempted: 1,
            imagesUpdated: 1,
            errors: 0,
        });
    });

    it('counts errors without throwing when contributors fail', async () => {
        jest.mocked(getPagesNeedingAuthors).mockResolvedValue([
            { id: 'page-1', url: 'https://ropewiki.com/Canyon' },
        ]);
        jest.mocked(getImagesNeedingAuthors).mockResolvedValue([]);
        jest.mocked(getContributors).mockRejectedValue(new Error('api down'));

        const summary = await backfillPageAndImageAuthors(conn);

        expect(summary.errors).toBe(1);
        expect(updateRopewikiPageAuthors).not.toHaveBeenCalled();
    });

    it('loads missing page urls for image-only backfill', async () => {
        jest.mocked(getPagesNeedingAuthors).mockResolvedValue([]);
        jest.mocked(getImagesNeedingAuthors).mockResolvedValue([
            {
                id: 'img-1',
                ropewikiPage: 'page-2',
                linkUrl: 'https://ropewiki.com/File:Pic.jpg',
            },
        ]);
        jest.mocked(getPagesByIds).mockResolvedValue([
            { id: 'page-2', url: 'https://ropewiki.com/Other' },
        ]);
        jest.mocked(getContributors).mockResolvedValue({
            'File:Pic.jpg': ['Carol'],
        });

        await backfillPageAndImageAuthors(conn);

        expect(getPagesByIds).toHaveBeenCalledWith(conn, ['page-2']);
        expect(getContributors).toHaveBeenCalledWith(['File:Pic.jpg']);
        expect(updateRopewikiPageAuthors).not.toHaveBeenCalled();
        expect(updateRopewikiImageAuthors).toHaveBeenCalledWith(conn, [
            { id: 'img-1', authors: ['Carol'] },
        ]);
    });
});
