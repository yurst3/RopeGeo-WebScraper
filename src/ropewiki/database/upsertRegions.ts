import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { RopewikiRegion } from '../types/region';
import { makeUnnestPart } from '../../helpers/makeUnnestPart';

// Insert or update a batch of regions.
// ON CONFLICT (name, parentRegion) DO UPDATE SET ... WHERE allowUpdates = true.
// Returns only rows that were actually inserted or updated (locked rows are not returned).
const upsertRegions = async (
    conn: db.Queryable,
    regions: RopewikiRegion[],
): Promise<RopewikiRegion[]> => {
    if (regions.length === 0) return [];

    const rows = regions.map((r) => r.toDbRow());
    const columns = RopewikiRegion.getDbInsertColumns();
    const unnestPart = makeUnnestPart(RopewikiRegion, rows);

    const returned = await db.sql<
        db.SQL,
        (s.RopewikiRegion.JSONSelectable)[]
    >`
        INSERT INTO "RopewikiRegion" ( ${db.cols(columns)} )
        SELECT
            t."name", t."parentRegion", t."rawPageCount", t."level", t."overview",
            t."bestMonths"::jsonb,
            t."isMajorRegion", t."isTopLevelRegion", t."latestRevisionDate", t."url", t."updatedAt", t."deletedAt"
        FROM unnest( ${unnestPart} ) AS t( ${db.cols(columns)} )
        ON CONFLICT ("name", "parentRegion") DO UPDATE SET
            "rawPageCount" = EXCLUDED."rawPageCount",
            "level" = EXCLUDED."level",
            "overview" = EXCLUDED."overview",
            "bestMonths" = EXCLUDED."bestMonths",
            "isMajorRegion" = EXCLUDED."isMajorRegion",
            "isTopLevelRegion" = EXCLUDED."isTopLevelRegion",
            "latestRevisionDate" = EXCLUDED."latestRevisionDate",
            "url" = EXCLUDED."url",
            "updatedAt" = EXCLUDED."updatedAt",
            "deletedAt" = EXCLUDED."deletedAt"
        WHERE "RopewikiRegion"."allowUpdates" = true
        RETURNING *
    `.run(conn);

    const key = (name: string, parentRegion: string | null) => `${name}\0${parentRegion ?? ''}`;
    const byKey = new Map(returned.map((row) => [key(row.name, row.parentRegion ?? null), row]));
    return regions
        .filter((r) => byKey.has(key(r.name, r.parentRegion ?? null)))
        .map((r) => RopewikiRegion.fromDbRow(byKey.get(key(r.name, r.parentRegion ?? null))!));
};

export default upsertRegions;
