import uniq from 'lodash/uniq';
import * as db from 'zapatos/db';

// Upsert site links and link them to the page.
// Inserts or updates RopewikiSiteLink for each URL, then upserts RopewikiPageSiteLink for each (page, siteLink).
const upsertSiteLinks = async (
    tx: db.Queryable,
    pageUuid: string,
    siteLinks: string[],
): Promise<void> => {
    if (siteLinks.length === 0) return;

    const uniqueUrls = uniq(siteLinks.filter((url) => url.trim().length > 0));
    if (uniqueUrls.length === 0) return;

    const now = new Date();

    const siteLinkRows = uniqueUrls.map((url) => ({
        url,
        updatedAt: now,
        deletedAt: null,
    }));

    const siteLinkResults = await db
        .upsert('RopewikiSiteLink', siteLinkRows, ['url'], {
            updateColumns: ['updatedAt', 'deletedAt'],
        })
        .run(tx);

    const pageSiteLinkRows = siteLinkResults.map((row) => ({
        page: pageUuid,
        siteLink: row.id,
        updatedAt: now,
        deletedAt: null,
    }));

    await db
        .upsert('RopewikiPageSiteLink', pageSiteLinkRows, ['page', 'siteLink'], {
            updateColumns: ['updatedAt', 'deletedAt'],
        })
        .run(tx);
};

export default upsertSiteLinks;
