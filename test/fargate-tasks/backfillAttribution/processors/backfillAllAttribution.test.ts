import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../../../../src/fargate-tasks/backfillAttribution/processors/backfillPageAndImageAuthors', () => ({
    backfillPageAndImageAuthors: jest.fn(),
}));
jest.mock('../../../../src/fargate-tasks/backfillAttribution/processors/backfillMapDataAuthors', () => ({
    backfillMapDataAuthors: jest.fn(),
}));

import { backfillAllAttribution } from '../../../../src/fargate-tasks/backfillAttribution/processors/backfillAllAttribution';
import { backfillPageAndImageAuthors } from '../../../../src/fargate-tasks/backfillAttribution/processors/backfillPageAndImageAuthors';
import { backfillMapDataAuthors } from '../../../../src/fargate-tasks/backfillAttribution/processors/backfillMapDataAuthors';

describe('backfillAllAttribution', () => {
    const conn = {} as never;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(backfillPageAndImageAuthors).mockResolvedValue({
            pagesAttempted: 2,
            pagesUpdated: 2,
            imagesAttempted: 3,
            imagesUpdated: 3,
            errors: 1,
        });
        jest.mocked(backfillMapDataAuthors).mockResolvedValue({
            mapDataAttempted: 4,
            mapDataUpdated: 4,
            errors: 2,
        });
    });

    it('runs both backfills in parallel and merges summaries', async () => {
        const summary = await backfillAllAttribution(conn);

        expect(backfillPageAndImageAuthors).toHaveBeenCalledWith(conn);
        expect(backfillMapDataAuthors).toHaveBeenCalledWith(conn);
        expect(summary).toEqual({
            pagesAttempted: 2,
            pagesUpdated: 2,
            imagesAttempted: 3,
            imagesUpdated: 3,
            mapDataAttempted: 4,
            mapDataUpdated: 4,
            errors: 3,
        });
    });
});
