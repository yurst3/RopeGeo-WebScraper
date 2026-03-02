import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import type { RopewikiPageView } from 'ropegeo-common';
import { Difficulty } from 'ropegeo-common';
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
    'id', 'pageId', 'name', 'aka', 'url', 'quality', 'userVotes', 'technicalRating', 'waterRating', 'timeRating', 'riskRating', 'permits', 'rappelInfo', 'rappelCount', 'rappelLongest', 'vehicle',
    'shuttleTime', 'minOverallTime', 'maxOverallTime', 'hikeLength', 'overallLength', 'minApproachTime', 'maxApproachTime', 'minDescentTime', 'maxDescentTime', 'minExitTime', 'maxExitTime', 'approachElevGain', 'exitElevGain',
    'months', 'latestRevisionDate', 'deletedAt', 'region',
];

/**
 * Fetches a single RopewikiPage by id and builds a RopewikiPageView (with banner image and beta sections).
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

    const [images, betaSections] = await Promise.all([
        db
            .select('RopewikiImage', { ropewikiPage: pageId }, { columns: ['order', 'fileUrl', 'linkUrl', 'caption', 'betaSection', 'latestRevisionDate', 'deletedAt'] })
            .run(conn)
            .then((rows) => rows.filter((r) => r.deletedAt == null))
            .then((rows) => rows.sort((a, b) => (a.betaSection ?? '').localeCompare(b.betaSection ?? '') || (a.order ?? 0) - (b.order ?? 0))),
        db
            .select('RopewikiBetaSection', { ropewikiPage: pageId }, { columns: ['id', 'order', 'title', 'text', 'latestRevisionDate', 'deletedAt'] })
            .run(conn)
            .then((rows) => rows.filter((r) => r.deletedAt == null).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))),
    ]);

    const bannerImageRow = images.find((i) => i.betaSection == null);
    const bannerImage = bannerImageRow
        ? {
              order: bannerImageRow.order ?? 0,
              url: bannerImageRow.fileUrl,
              linkUrl: bannerImageRow.linkUrl,
              caption: bannerImageRow.caption ?? '',
              latestRevisionDate: new Date(bannerImageRow.latestRevisionDate),
          }
        : null;

    const imagesBySection = new Map<string | null, typeof images>();
    for (const img of images) {
        const key = img.betaSection ?? null;
        if (!imagesBySection.has(key)) imagesBySection.set(key, []);
        imagesBySection.get(key)!.push(img);
    }

    const betaSectionsView = betaSections.map((sec) => {
        const secImages = (imagesBySection.get(sec.id) ?? []).map((i) => ({
            order: i.order ?? 0,
            url: i.fileUrl,
            linkUrl: i.linkUrl,
            caption: i.caption ?? '',
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
        pageId: page.pageId,
        name: page.name,
        aka: stringArray(page.aka),
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
        hikeLength: page.hikeLength == null ? null : numericValue(page.hikeLength),
        overallLength: page.overallLength == null ? null : numericValue(page.overallLength),
        approachTime: minMaxOrNumber(page.minApproachTime, page.maxApproachTime),
        descentTime: minMaxOrNumber(page.minDescentTime, page.maxDescentTime),
        exitTime: minMaxOrNumber(page.minExitTime, page.maxExitTime),
        approachElevGain: page.approachElevGain == null ? null : numericValue(page.approachElevGain),
        exitElevGain: page.exitElevGain == null ? null : numericValue(page.exitElevGain),
        months: page.months == null ? [] : stringArray(page.months),
        latestRevisionDate: new Date(page.latestRevisionDate),
        regions,
        bannerImage,
        betaSections: betaSectionsView,
    };

    return view as RopewikiPageView;
};

export default getRopewikiPageView;
