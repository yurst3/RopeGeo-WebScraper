import * as db from 'zapatos/db';
import {
    RegionImagesCursor,
    RopewikiRegionImagesParams,
} from 'ropegeo-common';
import type { RopewikiRegionImageViewRow } from 'ropegeo-common';

/** Build RegionImagesCursor for the next page from the last row. */
export function cursorFromRow(row: {
    sort_key: number;
    ropewikiPage: string;
    id: string;
}): RegionImagesCursor {
    return new RegionImagesCursor(Number(row.sort_key), row.ropewikiPage, row.id);
}

type ImageRow = RopewikiRegionImageViewRow & {
    sort_key: number;
};

/**
 * Returns one page of banner images (RopewikiImage with betaSection IS NULL) for pages in the given
 * region and its descendants, ordered by page popularity (quality * userVotes) DESC, then page id, then image id.
 * Uses keyset pagination via RegionImagesCursor (sortKey, pageId, imageId).
 */
export async function getRegionImagesPage(
    conn: db.Queryable,
    allowedRegionIds: string[],
    params: RopewikiRegionImagesParams,
): Promise<{ items: ImageRow[]; hasMore: boolean }> {
    const { limit, cursor } = params;
    const limitPlusOne = limit + 1;

    const cursorCondition = cursor
        ? db.sql`AND (
      (sort_key < ${db.param(cursor.sortKey)})
      OR (sort_key = ${db.param(cursor.sortKey)} AND "ropewikiPage" > ${db.param(cursor.pageId)}::uuid)
      OR (sort_key = ${db.param(cursor.sortKey)} AND "ropewikiPage" = ${db.param(cursor.pageId)}::uuid AND id > ${db.param(cursor.imageId)}::uuid)
    )`
        : db.sql``;

    const rows = await db.sql<db.SQL, ImageRow[]>`
    WITH RECURSIVE rd AS (
      SELECT id AS region_id, id AS descendant_id, name AS descendant_name
      FROM "RopewikiRegion"
      WHERE id = ANY(${db.param(allowedRegionIds)}::uuid[]) AND "deletedAt" IS NULL
      UNION ALL
      SELECT rd.region_id, r2.id, r2.name
      FROM "RopewikiRegion" r2
      INNER JOIN rd ON (
        r2."parentRegionName" = rd.descendant_name
        OR r2."parentRegionName" = rd.descendant_id::text
      )
      WHERE r2."deletedAt" IS NULL
    ),
    distinct_region_ids AS (
      SELECT DISTINCT descendant_id FROM rd
    ),
    images_with_score AS (
      SELECT
        i.id,
        i."ropewikiPage",
        p.name AS "pageName",
        (
          SELECT d."bannerUrl"
          FROM "ImageData" d
          WHERE d.id = i."processedImage"
            AND d."errorMessage" IS NULL
            AND d."bannerUrl" IS NOT NULL
        ) AS "fileUrl",
        i."linkUrl",
        i.caption,
        (COALESCE(p.quality, 0) * COALESCE(p."userVotes", 1))::float AS sort_key
      FROM distinct_region_ids dr
      INNER JOIN "RopewikiPage" p ON p.region = dr.descendant_id AND p."deletedAt" IS NULL
      INNER JOIN "RopewikiImage" i ON i."ropewikiPage" = p.id
        AND i."betaSection" IS NULL
        AND i."deletedAt" IS NULL
    ),
    filtered AS (
      SELECT id, "ropewikiPage", "pageName", "fileUrl", "linkUrl", caption, sort_key
      FROM images_with_score
      WHERE 1=1
      ${cursorCondition}
    )
    SELECT id, "ropewikiPage", "pageName", "fileUrl", "linkUrl", caption, sort_key
    FROM filtered
    ORDER BY sort_key DESC, "ropewikiPage" ASC, id ASC
    LIMIT ${db.param(limitPlusOne)}
  `.run(conn);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return { items, hasMore };
}
