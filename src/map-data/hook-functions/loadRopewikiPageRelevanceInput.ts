import type { Queryable } from 'zapatos/db';
import type * as s from 'zapatos/schema';
import getMapDataLegendItems from '../database/getMapDataLegendItems';
import getMapDataIdForRopewikiPage from '../database/getMapDataIdForRopewikiPage';
import getRopewikiPageRelevanceSourceData from '../../ropewiki/database/getRopewikiPageRelevanceSourceData';
import {
    imageHasCaption,
    type BetaSectionInput,
    type ImageInput,
    type LegendItemInput,
    type PageRelevanceInput,
    type PageStatsInput,
} from '../types/relevanceTypes';

function legendItemsFromRows(
    rows: Awaited<ReturnType<typeof getMapDataLegendItems>>,
): LegendItemInput[] {
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

/**
 * Builds {@link PageRelevanceInput} for a Ropewiki page by loading source rows and legend items.
 */
export async function loadRopewikiPageRelevanceInput(
    conn: Queryable,
    pageId: string,
): Promise<PageRelevanceInput> {
    const [{ page, betaSections, images }, mapDataId] = await Promise.all([
        getRopewikiPageRelevanceSourceData(conn, pageId),
        getMapDataIdForRopewikiPage(conn, pageId),
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
