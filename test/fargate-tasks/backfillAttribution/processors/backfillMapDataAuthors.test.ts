import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../../../../src/fargate-tasks/backfillAttribution/database/getMapDataNeedingAuthors', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../../src/fargate-tasks/backfillAttribution/database/updateMapDataAuthors', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../../src/map-data/hook-functions/getRopewikiMapDataAuthors', () => ({
    getRopewikiMapDataAuthors: jest.fn(),
    default: jest.fn(),
}));
jest.mock('../../../../src/fargate-tasks/backfillAttribution/util/sleep', () => ({
    __esModule: true,
    default: jest.fn(() => Promise.resolve()),
    sleep: jest.fn(() => Promise.resolve()),
}));

import { backfillMapDataAuthors } from '../../../../src/fargate-tasks/backfillAttribution/processors/backfillMapDataAuthors';
import getMapDataNeedingAuthors from '../../../../src/fargate-tasks/backfillAttribution/database/getMapDataNeedingAuthors';
import updateMapDataAuthors from '../../../../src/fargate-tasks/backfillAttribution/database/updateMapDataAuthors';
import { getRopewikiMapDataAuthors } from '../../../../src/map-data/hook-functions/getRopewikiMapDataAuthors';

describe('backfillMapDataAuthors', () => {
    const conn = {} as never;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(updateMapDataAuthors).mockResolvedValue(undefined);
    });

    it('updates authors for each MapData row', async () => {
        jest.mocked(getMapDataNeedingAuthors).mockResolvedValue([
            { id: 'md-1', sourceFileUrl: 'https://ropewiki.com/images/a/b/file.kml' },
        ]);
        jest.mocked(getRopewikiMapDataAuthors).mockResolvedValue(['Dave']);

        const summary = await backfillMapDataAuthors(conn);

        expect(getRopewikiMapDataAuthors).toHaveBeenCalledWith(
            'https://ropewiki.com/images/a/b/file.kml',
        );
        expect(updateMapDataAuthors).toHaveBeenCalledWith(conn, 'md-1', ['Dave']);
        expect(summary).toEqual({
            mapDataAttempted: 1,
            mapDataUpdated: 1,
            errors: 0,
        });
    });

    it('counts errors when update fails', async () => {
        jest.mocked(getMapDataNeedingAuthors).mockResolvedValue([
            { id: 'md-1', sourceFileUrl: 'https://ropewiki.com/images/a/b/file.kml' },
        ]);
        jest.mocked(getRopewikiMapDataAuthors).mockResolvedValue(['Dave']);
        jest.mocked(updateMapDataAuthors).mockRejectedValue(new Error('db fail'));

        const summary = await backfillMapDataAuthors(conn);

        expect(summary).toEqual({
            mapDataAttempted: 1,
            mapDataUpdated: 0,
            errors: 1,
        });
    });
});
