import uniq from 'lodash/uniq';
import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';

// Upsert site links and link them to the page.
// Uses raw SQL INSERT ... ON CONFLICT DO UPDATE WHERE allowUpdates = true.
const upsertSiteLinks = async (
    tx: db.Queryable,
    pageUuid: string,
    siteLinks: string[],
): Promise<void> => {
    if (siteLinks.length === 0) return;

    const uniqueUrls = uniq(siteLinks.filter((url) => url.trim().length > 0));
    if (uniqueUrls.length === 0) return;

    const now = new Date();

    const returned = await db.sql<
        db.SQL,
        (s.RopewikiSiteLink.JSONSelectable)[]
    >`
        INSERT INTO "RopewikiSiteLink" ("url", "updatedAt", "deletedAt")
        SELECT * FROM unnest(
            ${db.param(uniqueUrls)}::text[],
            ${db.param(uniqueUrls.map(() => now))}::timestamp[],
            ${db.param(uniqueUrls.map(() => null as Date | null))}::timestamp[]
        ) AS t("url", "updatedAt", "deletedAt")
        ON CONFLICT ("url") DO UPDATE SET
            "updatedAt" = EXCLUDED."updatedAt",
            "deletedAt" = EXCLUDED."deletedAt"
        WHERE "RopewikiSiteLink"."allowUpdates" = true
        RETURNING *
    `.run(tx);

    const byUrl = new Map(returned.map((row) => [row.url, row]));
    // For page-site-link join we need all site link ids (including locked) so the page can link to them
    const missingUrls = uniqueUrls.filter((url) => !byUrl.has(url));
    if (missingUrls.length > 0) {
        const locked = await db.sql<
            db.SQL,
            (s.RopewikiSiteLink.JSONSelectable)[]
        >`
            SELECT * FROM "RopewikiSiteLink"
            WHERE url = ANY(${db.param(missingUrls)}::text[])
        `.run(tx);
        for (const row of locked) byUrl.set(row.url, row);
    }
    const orderedSiteLinkRows = uniqueUrls.map((url) => byUrl.get(url)!);

    const pageSiteLinkRows = orderedSiteLinkRows.map((row) => ({
        page: pageUuid,
        siteLink: row.id,
        updatedAt: now,
        deletedAt: null as Date | null,
    }));

    const pages = pageSiteLinkRows.map((r) => r.page);
    const siteLinkIds = pageSiteLinkRows.map((r) => r.siteLink);
    const updatedAts = pageSiteLinkRows.map((r) => r.updatedAt);
    const deletedAts = pageSiteLinkRows.map((r) => r.deletedAt);

    await db.sql`
        INSERT INTO "RopewikiPageSiteLink" ("page", "siteLink", "updatedAt", "deletedAt")
        SELECT * FROM unnest(
            ${db.param(pages)}::uuid[],
            ${db.param(siteLinkIds)}::uuid[],
            ${db.param(updatedAts)}::timestamp[],
            ${db.param(deletedAts)}::timestamp[]
        ) AS t("page", "siteLink", "updatedAt", "deletedAt")
        ON CONFLICT ("page", "siteLink") DO UPDATE SET
            "updatedAt" = EXCLUDED."updatedAt",
            "deletedAt" = EXCLUDED."deletedAt"
        WHERE "RopewikiPageSiteLink"."allowUpdates" = true
    `.run(tx);
};

export default upsertSiteLinks;
