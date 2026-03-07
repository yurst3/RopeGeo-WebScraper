import type { RopewikiRegionViewRow } from 'ropegeo-common';
import { RopewikiRegionView } from 'ropegeo-common';
import * as db from 'zapatos/db';

/**
 * Fetches a single non-deleted RopewikiRegion by id and builds a RopewikiRegionView.
 * Resolves parent region id/name via left join. Returns null if the region does not exist or is deleted.
 */
const getRopewikiRegionView = async (
    conn: db.Queryable,
    regionId: string,
): Promise<RopewikiRegionView | null> => {
    const rows = await db.sql<
        db.SQL,
        (RopewikiRegionViewRow & { latestRevisionDate: Date })[]
    >`
        SELECT
            r.name,
            parent.id AS "parentRegionId",
            parent.name AS "parentRegionName",
            r."rawPageCount",
            r."truePageCount",
            r."trueRegionCount",
            r."truePageCountWithDescendents",
            r.overview,
            r."bestMonths",
            r."isMajorRegion",
            r."latestRevisionDate",
            r.url
        FROM "RopewikiRegion" r
        LEFT JOIN "RopewikiRegion" parent ON (
            (parent.name = r."parentRegionName" OR parent.id::text = r."parentRegionName")
            AND parent."deletedAt" IS NULL
        )
        WHERE r.id = ${db.param(regionId)}::uuid
          AND r."deletedAt" IS NULL
    `.run(conn);

    const row = rows[0];
    if (!row) return null;

    const viewRow: RopewikiRegionViewRow = {
        name: row.name,
        parentRegionId: row.parentRegionId ?? null,
        parentRegionName: row.parentRegionName ?? null,
        rawPageCount: row.rawPageCount ?? null,
        truePageCount: row.truePageCount ?? null,
        trueRegionCount: row.trueRegionCount ?? null,
        truePageCountWithDescendents: row.truePageCountWithDescendents ?? null,
        overview: row.overview ?? null,
        bestMonths: row.bestMonths ?? null,
        isMajorRegion: row.isMajorRegion ?? null,
        latestRevisionDate: row.latestRevisionDate,
        url: row.url,
    };
    return new RopewikiRegionView(viewRow);
};

export default getRopewikiRegionView;
