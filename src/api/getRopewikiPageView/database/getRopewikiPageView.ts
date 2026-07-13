import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import {
    AcaDifficultyRating,
    OnlineRopewikiPageView,
    RouteType,
} from 'ropegeo-common/models';
import getRopewikiRegionLineage from '../../../ropewiki/database/getRopewikiRegionLineage';
import numericValue from '../util/numericValue';
import parsePermit from '../util/parsePermit';
import parseVehicle from '../util/parseVehicle';
import parseRappelInfo from '../util/parseRappelInfo';
import stringArray from '../util/stringArray';
import { buildBannerImage, buildBetaSectionsView, type PageViewImageRow } from '../util/buildBetaSectionImages';
import { buildPageMiniMap, type RouteMapRow } from '../util/buildPageMiniMap';

/** Builds combined min/max time or single number from two DB jsonb columns. */
function parseLatLonComponent(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') return null;
        const n = Number(trimmed);
        if (Number.isFinite(n)) return n;
    }
    return null;
}

/** Normalizes RopewikiPage.coordinates jsonb to WGS84 degrees or null when missing/invalid. */
function normalizePageCoordinates(raw: db.JSONValue | null): { lat: number; lon: number } | null {
    if (raw == null) return null;
    if (typeof raw !== 'object' || Array.isArray(raw)) return null;
    const o = raw as Record<string, unknown>;
    const lat = parseLatLonComponent(o.lat);
    const lon = parseLatLonComponent(o.lon);
    if (lat === null || lon === null) return null;
    return { lat, lon };
}

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

function normalizeRouteType(routeType: string | undefined): RouteType {
    if (routeType != null && Object.values(RouteType).includes(routeType as RouteType)) {
        return routeType as RouteType;
    }
    return RouteType.Unknown;
}

const ROPEWIKI_PAGE_VIEW_COLUMNS: (keyof s.RopewikiPage.Selectable)[] = [
    'id', 'name', 'url', 'quality', 'userVotes', 'technicalRating', 'waterRating', 'timeRating', 'riskRating', 'permits', 'rappelInfo', 'rappelCount', 'rappelLongest', 'vehicle',
    'shuttleTime', 'minOverallTime', 'maxOverallTime', 'overallLength', 'approachLength', 'approachElevGain', 'descentLength', 'descentElevGain', 'exitLength', 'exitElevGain',
    'minApproachTime', 'maxApproachTime', 'minDescentTime', 'maxDescentTime', 'minExitTime', 'maxExitTime',
    'months', 'latestRevisionDate', 'deletedAt', 'region', 'coordinates', 'downloadFolder',
];

/**
 * Fetches a single RopewikiPage by id and builds a RopewikiPageView (with banner image and beta sections).
 * Maps DB length/elev columns (overallLength, approachLength, approachElevGain, descentLength, descentElevGain, exitLength, exitElevGain) to the view.
 * Exposes `coordinates` from `RopewikiPage.coordinates` when lat/lon are usable; otherwise null (not inferred from minimap bounds).
 * Returns null if the page does not exist or is deleted.
 */
const getRopewikiPageView = async (
    conn: db.Queryable,
    pageId: string,
): Promise<OnlineRopewikiPageView | null> => {
    const rows = await db
        .select('RopewikiPage', { id: pageId }, { columns: ROPEWIKI_PAGE_VIEW_COLUMNS })
        .run(conn);
    const page = rows[0] as s.RopewikiPage.Selectable | undefined;

    if (!page || page.deletedAt != null) return null;

    const [imageRows, betaSections, akaRows, routeMapRows] = await Promise.all([
        db.sql<db.SQL, PageViewImageRow[]>`
            SELECT
                i.id,
                i."order",
                i."linkUrl",
                i.caption,
                i."betaSection",
                i."latestRevisionDate",
                d."previewUrl",
                d."bannerUrl",
                d."fullUrl",
                d."linkPreviewUrl",
                d."metadata"
            FROM "RopewikiImage" i
            LEFT JOIN "ImageData" d ON d.id = i."processedImage"
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
        db.sql<db.SQL, RouteMapRow[]>`
            SELECT
                r.id AS "routeId",
                r.name AS "routeName",
                r.type AS "routeType",
                m.id AS "mapDataId",
                m."tilesTemplate",
                m."tileCount",
                m."tileTotalBytes",
                m."bounds"
            FROM "RopewikiRoute" rr
            INNER JOIN "Route" r ON r.id = rr.route AND r."deletedAt" IS NULL
            LEFT JOIN "MapData" m ON m.id = rr."mapData"
            WHERE rr."ropewikiPage" = ${db.param(pageId)}::uuid
              AND rr."deletedAt" IS NULL
            ORDER BY rr."createdAt" ASC NULLS LAST
            LIMIT 1
        `.run(conn),
    ]);

    const routeRow = routeMapRows[0];
    const [miniMap, regions] = await Promise.all([
        buildPageMiniMap(conn, page, routeRow, betaSections),
        getRopewikiRegionLineage(conn, page.region),
    ]);

    const bannerImage = buildBannerImage(imageRows);
    const betaSectionsView = buildBetaSectionsView(betaSections, imageRows);
    const difficultyRating = new AcaDifficultyRating(
        page.technicalRating,
        page.waterRating,
        page.timeRating,
        page.riskRating,
    );
    const { rappelCount, jumps } = parseRappelInfo(page.rappelInfo, page.rappelCount);
    const coordinates = normalizePageCoordinates(page.coordinates);

    return new OnlineRopewikiPageView(
        page.id,
        normalizeRouteType(routeRow?.routeType),
        page.name,
        akaRows,
        page.url,
        Number(page.quality ?? 0),
        Number(page.userVotes ?? 0),
        regions,
        difficultyRating,
        parsePermit(page.permits),
        rappelCount,
        jumps,
        parseVehicle(page.vehicle),
        page.rappelLongest == null ? null : numericValue(page.rappelLongest),
        page.shuttleTime == null ? null : numericValue(page.shuttleTime),
        page.overallLength != null ? Number(page.overallLength) : null,
        page.descentLength != null ? Number(page.descentLength) : null,
        page.exitLength != null ? Number(page.exitLength) : null,
        page.approachLength != null ? Number(page.approachLength) : null,
        minMaxOrNumber(page.minOverallTime, page.maxOverallTime),
        minMaxOrNumber(page.minApproachTime, page.maxApproachTime),
        minMaxOrNumber(page.minDescentTime, page.maxDescentTime),
        minMaxOrNumber(page.minExitTime, page.maxExitTime),
        page.approachElevGain != null ? Number(page.approachElevGain) : null,
        page.descentElevGain != null ? Number(page.descentElevGain) : null,
        page.exitElevGain != null ? Number(page.exitElevGain) : null,
        page.months == null ? [] : stringArray(page.months),
        new Date(page.latestRevisionDate),
        bannerImage,
        betaSectionsView,
        miniMap,
        coordinates,
        page.downloadFolder ?? null,
    );
};

export default getRopewikiPageView;
