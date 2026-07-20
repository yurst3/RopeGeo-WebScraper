import { describe, it, expect } from '@jest/globals';
import {
    addPageBackfillCounts,
    emptyPageBackfillCounts,
} from '../../../../src/fargate-tasks/backfillAttribution/util/pageBackfillCounts';
import {
    addMapDataBackfillCounts,
    emptyMapDataBackfillCounts,
} from '../../../../src/fargate-tasks/backfillAttribution/util/mapDataBackfillCounts';

describe('backfill count helpers', () => {
    it('adds page backfill counts', () => {
        expect(
            addPageBackfillCounts(
                { pagesAttempted: 1, pagesUpdated: 1, imagesAttempted: 2, imagesUpdated: 2, errors: 0 },
                { pagesAttempted: 1, pagesUpdated: 0, imagesAttempted: 1, imagesUpdated: 1, errors: 1 },
            ),
        ).toEqual({
            pagesAttempted: 2,
            pagesUpdated: 1,
            imagesAttempted: 3,
            imagesUpdated: 3,
            errors: 1,
        });
    });

    it('empty page counts start at zero', () => {
        expect(emptyPageBackfillCounts()).toEqual({
            pagesAttempted: 0,
            pagesUpdated: 0,
            imagesAttempted: 0,
            imagesUpdated: 0,
            errors: 0,
        });
    });

    it('adds map data backfill counts', () => {
        expect(
            addMapDataBackfillCounts(
                emptyMapDataBackfillCounts(),
                { mapDataAttempted: 2, mapDataUpdated: 1, errors: 1 },
            ),
        ).toEqual({ mapDataAttempted: 2, mapDataUpdated: 1, errors: 1 });
    });
});
