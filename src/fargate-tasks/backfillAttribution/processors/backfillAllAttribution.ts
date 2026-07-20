import type { Queryable } from 'zapatos/db';
import { backfillPageAndImageAuthors } from './backfillPageAndImageAuthors';
import { backfillMapDataAuthors } from './backfillMapDataAuthors';

export type BackfillSummary = {
    pagesAttempted: number;
    pagesUpdated: number;
    imagesAttempted: number;
    imagesUpdated: number;
    mapDataAttempted: number;
    mapDataUpdated: number;
    errors: number;
};

export async function backfillAllAttribution(
    conn: Queryable,
): Promise<BackfillSummary> {
    const [pageImage, mapData] = await Promise.all([
        backfillPageAndImageAuthors(conn),
        backfillMapDataAuthors(conn),
    ]);
    return {
        ...pageImage,
        ...mapData,
        errors: pageImage.errors + mapData.errors,
    };
}
