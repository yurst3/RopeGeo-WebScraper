import type { Queryable } from 'zapatos/db';
import getContributors from '../../../ropewiki/http/getContributors';
import updateRopewikiPageAuthors from '../../../ropewiki/database/updateRopewikiPageAuthors';
import updateRopewikiImageAuthors from '../../../ropewiki/database/updateRopewikiImageAuthors';
import getPagesNeedingAuthors from '../database/getPagesNeedingAuthors';
import getImagesNeedingAuthors from '../database/getImagesNeedingAuthors';
import getPagesByIds from '../database/getPagesByIds';
import {
    BACKFILL_BATCH_SIZE,
    BACKFILL_INTER_BATCH_DELAY_MS,
} from '../util/constants';
import runInBatches from '../util/runInBatches';
import buildPageAuthorWorkItems, {
    type PageAuthorWorkItem,
} from '../util/buildPageAuthorWorkItems';
import {
    addPageBackfillCounts,
    emptyPageBackfillCounts,
    type PageBackfillCounts,
} from '../util/pageBackfillCounts';
import {
    contributorTitlesForWorkItem,
    imageAuthorUpdatesFromContributors,
    pageAuthorsFromContributors,
} from '../util/contributorLookups';

async function backfillOnePage(
    conn: Queryable,
    item: PageAuthorWorkItem,
): Promise<PageBackfillCounts> {
    const counts = emptyPageBackfillCounts();
    try {
        const byTitle = await getContributors(contributorTitlesForWorkItem(item));

        if (item.pageNeedsAuthors) {
            counts.pagesAttempted = 1;
            await updateRopewikiPageAuthors(
                conn,
                item.page.id,
                pageAuthorsFromContributors(byTitle, item.page.url),
            );
            counts.pagesUpdated = 1;
        }

        if (item.pageImages.length > 0) {
            counts.imagesAttempted = item.pageImages.length;
            const updates = imageAuthorUpdatesFromContributors(item.pageImages, byTitle);
            await updateRopewikiImageAuthors(conn, updates);
            counts.imagesUpdated = updates.length;
        }
    } catch (err) {
        counts.errors = 1;
        console.error(
            `backfill page ${item.page.id} failed: ${
                err instanceof Error ? err.message : String(err)
            }`,
        );
    }
    return counts;
}

export async function backfillPageAndImageAuthors(
    conn: Queryable,
): Promise<PageBackfillCounts> {
    const pages = await getPagesNeedingAuthors(conn);
    const images = await getImagesNeedingAuthors(conn);

    const pageById = new Map(pages.map((p) => [p.id, p]));
    const missingPageIds = [
        ...new Set(images.map((i) => i.ropewikiPage)),
    ].filter((id) => !pageById.has(id));
    const extraPages = await getPagesByIds(conn, missingPageIds);
    extraPages.forEach((p) => {
        pageById.set(p.id, p);
    });

    const workItems = buildPageAuthorWorkItems(pages, images, pageById);
    const batchCounts = await runInBatches(
        workItems,
        BACKFILL_BATCH_SIZE,
        (item) => backfillOnePage(conn, item),
        BACKFILL_INTER_BATCH_DELAY_MS,
    );

    return batchCounts.reduce(addPageBackfillCounts, emptyPageBackfillCounts());
}

export default backfillPageAndImageAuthors;
