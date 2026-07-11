import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import getMapDataLegendItems from '../../src/map-data/database/getMapDataLegendItems';
import {
    imageHasCaption,
    type BetaSectionInput,
    type ImageInput,
    type LegendItemInput,
    type PageRelevanceInput,
    type PageStatsInput,
} from './types';

type MapDataRouteRow = {
    mapDataId: string;
};

async function resolveMapDataIdForPage(conn: db.Queryable, pageId: string): Promise<string | null> {
    const routeRows = await db.sql<db.SQL, MapDataRouteRow[]>`
        SELECT m.id AS "mapDataId"
        FROM "RopewikiRoute" rr
        INNER JOIN "Route" r ON r.id = rr.route AND r."deletedAt" IS NULL
        INNER JOIN "MapData" m ON m.id = rr."mapData"
        WHERE rr."ropewikiPage" = ${db.param(pageId)}::uuid
          AND rr."deletedAt" IS NULL
        ORDER BY (
            (SELECT COUNT(*) FROM "MapDataMarkerLegendItem" WHERE "mapData" = m.id)
            + (SELECT COUNT(*) FROM "MapDataSegmentLegendItem" WHERE "mapData" = m.id)
            + (SELECT COUNT(*) FROM "MapDataPolygonLegendItem" WHERE "mapData" = m.id)
        ) DESC,
        rr."createdAt" ASC NULLS LAST
        LIMIT 1
    `.run(conn);

    return routeRows[0]?.mapDataId ?? null;
}

function legendItemsFromRows(rows: Awaited<ReturnType<typeof getMapDataLegendItems>>): LegendItemInput[] {
    const items: LegendItemInput[] = [];
    for (const row of rows.markerRows) {
        items.push({ id: row.id, featureType: 'point', name: row.name });
    }
    for (const row of rows.segmentRows) {
        items.push({ id: row.id, featureType: 'line', name: row.name });
    }
    for (const row of rows.polygonRows) {
        items.push({ id: row.id, featureType: 'polygon', name: row.name });
    }
    return items;
}

function pageStatsFromRow(page: s.RopewikiPage.JSONSelectable): PageStatsInput {
    return {
        approachLength: page.approachLength,
        descentLength: page.descentLength,
        exitLength: page.exitLength,
        approachElevGain: page.approachElevGain,
        descentElevGain: page.descentElevGain,
        exitElevGain: page.exitElevGain,
        minApproachTime: page.minApproachTime,
        maxApproachTime: page.maxApproachTime,
        minDescentTime: page.minDescentTime,
        maxDescentTime: page.maxDescentTime,
        minExitTime: page.minExitTime,
        maxExitTime: page.maxExitTime,
        shuttleTime: page.shuttleTime,
    };
}

export async function loadPageRelevanceInput(
    conn: db.Queryable,
    pageId: string,
): Promise<PageRelevanceInput> {
    const page = await db.selectOne('RopewikiPage', { id: pageId }).run(conn);
    if (page == null) {
        throw new Error(`RopewikiPage not found: ${pageId}`);
    }

    const [betaSections, images, mapDataId] = await Promise.all([
        db
            .select(
                'RopewikiBetaSection',
                { ropewikiPage: pageId, deletedAt: db.conditions.isNull },
                { columns: ['id', 'title', 'text', 'order'], order: { by: 'order', direction: 'ASC' } },
            )
            .run(conn),
        db
            .select(
                'RopewikiImage',
                { ropewikiPage: pageId, deletedAt: db.conditions.isNull },
                {
                    columns: ['id', 'betaSection', 'caption', 'order'],
                    order: { by: 'order', direction: 'ASC' },
                },
            )
            .run(conn),
        resolveMapDataIdForPage(conn, pageId),
    ]);

    let legendItems: LegendItemInput[] = [];
    if (mapDataId != null) {
        const legendRows = await getMapDataLegendItems(conn, mapDataId);
        legendItems = legendItemsFromRows(legendRows);
    }

    const betaSectionInputs: BetaSectionInput[] = betaSections.map((section) => ({
        id: section.id,
        title: section.title,
        text: section.text,
        order: section.order,
    }));

    const betaSectionTitleById = new Map(betaSections.map((section) => [section.id, section.title]));

    const imageInputs: ImageInput[] = images
        .filter((image) => imageHasCaption(image.caption))
        .map((image) => ({
            id: image.id,
            betaSectionId: image.betaSection,
            betaSectionTitle:
                image.betaSection != null
                    ? (betaSectionTitleById.get(image.betaSection) ?? null)
                    : null,
            caption: image.caption,
            order: image.order,
        }));

    return {
        page: {
            id: page.id,
            name: page.name,
            url: page.url,
        },
        mapDataId,
        legendItems,
        betaSections: betaSectionInputs,
        images: imageInputs,
        pageStats: pageStatsFromRow(page),
    };
}
