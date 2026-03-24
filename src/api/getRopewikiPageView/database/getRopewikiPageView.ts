import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import type { RopewikiPageView } from 'ropegeo-common';
import { Bounds, Difficulty, PageMiniMap } from 'ropegeo-common';
import getRopewikiRegionLineage from '../../../ropewiki/database/getRopewikiRegionLineage';
import numericValue from '../util/numericValue';
import parsePermit from '../util/parsePermit';
import parseRappelInfo from '../util/parseRappelInfo';
import stringArray from '../util/stringArray';

/** Builds combined min/max time or single number from two DB jsonb columns. */
function minMaxOrNumber(
    minRaw: db.JSONValue | null,
    maxRaw: db.JSONValue | null,
): { min: number; max: number } | number | null {
    const minVal = minRaw == null ? null : numericValue(minRaw);
    const maxVal = maxRaw == null ? null : numericValue(maxRaw);
    if (minVal == null && maxVal == null) return null;
    if (minVal == null) return maxVal;
    if (maxVal == null) return minVal;
    if (minVal === maxVal) return minVal;
    return { min: Math.min(minVal, maxVal), max: Math.max(minVal, maxVal) };
}

const ROPEWIKI_PAGE_VIEW_COLUMNS: (keyof s.RopewikiPage.Selectable)[] = [
    'id', 'name', 'url', 'quality', 'userVotes', 'technicalRating', 'waterRating', 'timeRating', 'riskRating', 'permits', 'rappelInfo', 'rappelCount', 'rappelLongest', 'vehicle',
    'shuttleTime', 'minOverallTime', 'maxOverallTime', 'overallLength', 'approachLength', 'approachElevGain', 'descentLength', 'descentElevGain', 'exitLength', 'exitElevGain',
    'minApproachTime', 'maxApproachTime', 'minDescentTime', 'maxDescentTime', 'minExitTime', 'maxExitTime',
    'months', 'latestRevisionDate', 'deletedAt', 'region',
];

/**
 * Fetches a single RopewikiPage by id and builds a RopewikiPageView (with banner image and beta sections).
 * Maps DB length/elev columns (overallLength, approachLength, approachElevGain, descentLength, descentElevGain, exitLength, exitElevGain) to the view.
 * Returns null if the page does not exist or is deleted.
 */
const getRopewikiPageView = async (
    conn: db.Queryable,
    pageId: string,
): Promise<RopewikiPageView | null> => {
    const rows = await db
        .select('RopewikiPage', { id: pageId }, { columns: ROPEWIKI_PAGE_VIEW_COLUMNS })
        .run(conn);
    const page = rows[0] as s.RopewikiPage.Selectable | undefined;

    if (!page || page.deletedAt != null) return null;

    type ImageRow = {
        order: number | null;
        linkUrl: string;
        caption: string | null;
        betaSection: string | null;
        latestRevisionDate: db.TimestampString;
        bannerUrl: string | null;
        fullUrl: string | null;
    };

    type MapDataRow = {
        id: string;
        tilesTemplate: string | null;
        bounds: { north: number; south: number; east: number; west: number } | null;
    };

    const [imageRows, betaSections, akaRows, mapDataRows] = await Promise.all([
        db.sql<db.SQL, ImageRow[]>`
            SELECT
                i."order",
                i."linkUrl",
                i.caption,
                i."betaSection",
                i."latestRevisionDate",
                (
                    SELECT d."bannerUrl"
                    FROM "ImageData" d
                    WHERE d.id = i."processedImage"
                ) AS "bannerUrl"
                ,
                (
                    SELECT d."fullUrl"
                    FROM "ImageData" d
                    WHERE d.id = i."processedImage"
                ) AS "fullUrl"
            FROM "RopewikiImage" i
            WHERE i."ropewikiPage" = ${db.param(pageId)}::uuid
              AND i."deletedAt" IS NULL
            ORDER BY (i."betaSection" IS NULL) DESC, i."betaSection" ASC NULLS LAST, i."order" ASC NULLS LAST
        `.run(conn),
        db
            .select('RopewikiBetaSection', { ropewikiPage: pageId }, { columns: ['id', 'order', 'title', 'text', 'latestRevisionDate', 'deletedAt'] })
            .run(conn)
            .then((rows) => rows.filter((r) => r.deletedAt == null).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))),
        db
            .select(
                'RopewikiAkaName',
                { ropewikiPage: pageId, deletedAt: db.conditions.isNull },
                { columns: ['name'], order: { by: 'name', direction: 'ASC' } },
            )
            .run(conn)
            .then((rows) => rows.map((r) => r.name)),
        db.sql<db.SQL, MapDataRow[]>`
            SELECT m.id,
                   m."tilesTemplate",
                   m."bounds"
            FROM "RopewikiRoute" rr
            INNER JOIN "MapData" m ON m.id = rr."mapData"
            WHERE rr."ropewikiPage" = ${db.param(pageId)}::uuid
              AND rr."deletedAt" IS NULL
            LIMIT 1
        `.run(conn),
    ]);

    const firstMapDataRow = mapDataRows[0];
    let tilesTemplate = firstMapDataRow?.tilesTemplate ?? null;
    const rawBounds = firstMapDataRow?.bounds ?? null;
    let bounds =
        rawBounds != null &&
        typeof rawBounds === 'object' &&
        typeof (rawBounds as Record<string, unknown>).north === 'number' &&
        typeof (rawBounds as Record<string, unknown>).south === 'number' &&
        typeof (rawBounds as Record<string, unknown>).east === 'number' &&
        typeof (rawBounds as Record<string, unknown>).west === 'number'
            ? (rawBounds as { north: number; south: number; east: number; west: number })
            : null;

    // Keep tilesTemplate and bounds mutually consistent:
    // - If there is no tilesTemplate, there should also be no bounds.
    // - If bounds are missing, clear tilesTemplate.
    if (tilesTemplate == null) {
        bounds = null;
    } else if (bounds == null) {
        tilesTemplate = null;
    }

    const mapDataId = firstMapDataRow?.id;
    const layerId =
        mapDataId != null && typeof mapDataId === 'string' && mapDataId.length > 0
            ? mapDataId
            : null;
    const miniMap =
        layerId != null && tilesTemplate != null && bounds != null
            ? new PageMiniMap(
                  layerId,
                  tilesTemplate,
                  new Bounds(bounds.north, bounds.south, bounds.east, bounds.west),
              )
            : null;

    const bannerImageRow = imageRows.find((i) => i.betaSection == null);
    const bannerImage = bannerImageRow
        ? {
              order: bannerImageRow.order ?? 0,
              bannerUrl: bannerImageRow.bannerUrl,
              fullUrl: bannerImageRow.fullUrl,
              linkUrl: bannerImageRow.linkUrl,
              caption: bannerImageRow.caption,
              latestRevisionDate: new Date(bannerImageRow.latestRevisionDate),
          }
        : null;

    const imagesBySection = new Map<string | null, ImageRow[]>();
    for (const img of imageRows) {
        const key = img.betaSection ?? null;
        if (!imagesBySection.has(key)) imagesBySection.set(key, []);
        imagesBySection.get(key)!.push(img);
    }

    const betaSectionsView = betaSections.map((sec) => {
        const secImages = (imagesBySection.get(sec.id) ?? []).map((i) => ({
                order: i.order ?? 0,
                bannerUrl: i.bannerUrl,
                fullUrl: i.fullUrl,
                linkUrl: i.linkUrl,
                caption: i.caption,
                latestRevisionDate: new Date(i.latestRevisionDate),
            }));
        return {
            order: sec.order ?? 0,
            title: sec.title,
            text: sec.text,
            images: secImages,
            latestRevisionDate: new Date(sec.latestRevisionDate),
        };
    });

    const difficulty = new Difficulty(
        page.technicalRating,
        page.waterRating,
        page.timeRating,
        page.riskRating,
    );

    const { rappelCount, jumps } = parseRappelInfo(page.rappelInfo, page.rappelCount);

    const regions = await getRopewikiRegionLineage(conn, page.region);

    const view = {
        name: page.name,
        aka: akaRows,
        url: page.url,
        quality: page.quality ?? 0,
        userVotes: page.userVotes ?? 0,
        difficulty: difficulty as RopewikiPageView['difficulty'],
        permit: parsePermit(page.permits),
        rappelCount,
        jumps,
        vehicle: page.vehicle ?? null,
        rappelLongest: page.rappelLongest == null ? null : numericValue(page.rappelLongest),
        shuttleTime: page.shuttleTime == null ? null : numericValue(page.shuttleTime),
        overallTime: minMaxOrNumber(page.minOverallTime, page.maxOverallTime),
        overallLength: page.overallLength != null ? Number(page.overallLength) : null,
        approachLength: page.approachLength != null ? Number(page.approachLength) : null,
        approachElevGain: page.approachElevGain != null ? Number(page.approachElevGain) : null,
        descentLength: page.descentLength != null ? Number(page.descentLength) : null,
        descentElevGain: page.descentElevGain != null ? Number(page.descentElevGain) : null,
        exitLength: page.exitLength != null ? Number(page.exitLength) : null,
        exitElevGain: page.exitElevGain != null ? Number(page.exitElevGain) : null,
        approachTime: minMaxOrNumber(page.minApproachTime, page.maxApproachTime),
        descentTime: minMaxOrNumber(page.minDescentTime, page.maxDescentTime),
        exitTime: minMaxOrNumber(page.minExitTime, page.maxExitTime),
        months: page.months == null ? [] : stringArray(page.months),
        latestRevisionDate: new Date(page.latestRevisionDate),
        regions,
        bannerImage,
        betaSections: betaSectionsView,
        miniMap,
    };

    return view as RopewikiPageView;
};

export default getRopewikiPageView;
