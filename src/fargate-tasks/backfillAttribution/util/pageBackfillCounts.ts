export type PageBackfillCounts = {
    pagesAttempted: number;
    pagesUpdated: number;
    imagesAttempted: number;
    imagesUpdated: number;
    errors: number;
};

export const emptyPageBackfillCounts = (): PageBackfillCounts => ({
    pagesAttempted: 0,
    pagesUpdated: 0,
    imagesAttempted: 0,
    imagesUpdated: 0,
    errors: 0,
});

export const addPageBackfillCounts = (
    a: PageBackfillCounts,
    b: PageBackfillCounts,
): PageBackfillCounts => ({
    pagesAttempted: a.pagesAttempted + b.pagesAttempted,
    pagesUpdated: a.pagesUpdated + b.pagesUpdated,
    imagesAttempted: a.imagesAttempted + b.imagesAttempted,
    imagesUpdated: a.imagesUpdated + b.imagesUpdated,
    errors: a.errors + b.errors,
});
