import type { Queryable } from 'zapatos/db';
import type * as s from 'zapatos/schema';
import {
    LegendItem,
    OnlineBetaSection,
} from 'ropegeo-common/models';
import getMapDataLegendItems from '../../../map-data/database/getMapDataLegendItems';
import getRelevantContextByMapDataId from '../../../map-data/database/getRelevantContextByMapDataId';
import { attachRelevantContextToLegendRecord } from '../../../map-data/util/enrichRelevantContextForLegend';
import { legendRecordFromRows } from '../../../map-data/types/mapDataLegendItem';

type BetaSectionRow = Pick<
    s.RopewikiBetaSection.JSONSelectable,
    'id' | 'order' | 'title' | 'text' | 'latestRevisionDate'
>;

/**
 * Loads legend items for a MapData id and attaches stored relevant context when present.
 * Returns undefined when there are no legend rows or parsing fails.
 */
export async function loadPageLegend(
    conn: Queryable,
    mapDataId: string,
    betaSections: BetaSectionRow[],
): Promise<Record<string, LegendItem> | undefined> {
    try {
        const legendRows = await getMapDataLegendItems(conn, mapDataId);
        const parsed = legendRecordFromRows(legendRows);
        if (Object.keys(parsed).length === 0) {
            return undefined;
        }

        const contextByLegendItemId = await getRelevantContextByMapDataId(conn, mapDataId);
        if (contextByLegendItemId.size === 0) {
            return parsed;
        }

        const betaSectionById = new Map(
            betaSections.map((sec) => [
                sec.id,
                new OnlineBetaSection(
                    sec.order ?? 0,
                    sec.title,
                    sec.text,
                    new Date(sec.latestRevisionDate),
                    [],
                    sec.id,
                ),
            ]),
        );

        return attachRelevantContextToLegendRecord(
            parsed,
            contextByLegendItemId,
            betaSectionById,
        );
    } catch (e) {
        console.warn(
            'getRopewikiPageView: invalid MapData legend items, omitting from miniMap:',
            e instanceof Error ? e.message : e,
        );
        return undefined;
    }
}
