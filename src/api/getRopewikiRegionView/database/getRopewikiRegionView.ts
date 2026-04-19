import {
    OnlineRegionMiniMap,
    PageDataSource,
    RopewikiRegionView,
    RoutesParams,
} from 'ropegeo-common/models';
import * as db from 'zapatos/db';
import getRopewikiRegionRouteBounds from '../../../ropewiki/database/getRopewikiRegionRouteBounds';

interface GetRopewikiRegionViewRow {
    name: string;
    rawPageCount: number | null;
    truePageCount: number | null;
    trueRegionCount: number | null;
    truePageCountWithDescendents: number | null;
    overview: string | null;
    bestMonths: string[] | null;
    isMajorRegion: boolean | null;
    latestRevisionDate: Date;
    url: string;
    updatedAt: Date;
    /** JSON array of { id, name } from immediate parent up to root. */
    regionsJson: string;
}

/**
 * Fetches a single non-deleted RopewikiRegion by id and builds a RopewikiRegionView.
 * Resolves full parent lineage (immediate parent up to root) via recursive CTE.
 * Returns null if the region does not exist or is deleted.
 */
const getRopewikiRegionView = async (
    conn: db.Queryable,
    regionId: string,
): Promise<RopewikiRegionView | null> => {
    const rows = await db.sql<db.SQL, GetRopewikiRegionViewRow[]>`
        WITH RECURSIVE ancestors(depth, id, name, "parentRegionName") AS (
            SELECT 1, parent.id, parent.name, parent."parentRegionName"
            FROM "RopewikiRegion" r
            JOIN "RopewikiRegion" parent ON (
                (parent.name = r."parentRegionName" OR parent.id::text = r."parentRegionName")
                AND parent."deletedAt" IS NULL
            )
            WHERE r.id = ${db.param(regionId)}::uuid AND r."deletedAt" IS NULL
            UNION ALL
            SELECT a.depth + 1, p.id, p.name, p."parentRegionName"
            FROM "RopewikiRegion" p
            INNER JOIN ancestors a ON (
                (p.name = a."parentRegionName" OR p.id::text = a."parentRegionName")
                AND p."deletedAt" IS NULL
            )
        )
        SELECT
            r.name,
            r."rawPageCount",
            r."truePageCount",
            r."trueRegionCount",
            r."truePageCountWithDescendents",
            r.overview,
            r."bestMonths",
            r."isMajorRegion",
            r."latestRevisionDate",
            r.url,
            r."updatedAt",
            COALESCE(
                (SELECT json_agg(json_build_object('id', an.id, 'name', an.name) ORDER BY an.depth)
                 FROM ancestors an),
                '[]'::json
            )::text AS "regionsJson"
        FROM "RopewikiRegion" r
        WHERE r.id = ${db.param(regionId)}::uuid
          AND r."deletedAt" IS NULL
    `.run(conn);

    const row = rows[0];
    if (!row) return null;

    const regionsParsed = JSON.parse(row.regionsJson) as { id: string; name: string }[];
    const regions =
        Array.isArray(regionsParsed) && regionsParsed.length > 0 ? regionsParsed : undefined;

    const bounds = await getRopewikiRegionRouteBounds(conn, regionId);
    const miniMap = new OnlineRegionMiniMap(
        new RoutesParams({
            region: { id: regionId, source: PageDataSource.Ropewiki },
        }),
        bounds,
        row.name,
    );

    return new RopewikiRegionView(
        row.name,
        row.latestRevisionDate,
        row.url,
        row.updatedAt,
        miniMap,
        regions,
        row.rawPageCount ?? null,
        row.truePageCount ?? null,
        row.trueRegionCount ?? null,
        row.truePageCountWithDescendents ?? null,
        row.overview ?? null,
        row.bestMonths ?? null,
        row.isMajorRegion ?? null,
    );
};

export default getRopewikiRegionView;
