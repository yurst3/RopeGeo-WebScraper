import * as db from 'zapatos/db';
import type { LegendItem } from 'ropegeo-common/models';
import replaceMapDataLegendItems from '../database/replaceMapDataLegendItems';
import { upsertRelevanceContextJob } from '../database/upsertRelevanceContextJob';
import { MapDataEvent } from '../types/mapDataEvent';

/**
 * After a successful MapData upsert, replaces legend items and optionally enqueues
 * a relevance-context job.
 */
const applyUpsertedMapData = async (
    conn: db.Queryable,
    applied: boolean,
    mapDataId: string | undefined,
    legend: Record<string, LegendItem> | undefined,
    mapDataEvent: MapDataEvent,
): Promise<void> => {
    if (!applied || mapDataId == null) {
        return;
    }

    await replaceMapDataLegendItems(conn, mapDataId, legend);
    if (mapDataEvent.processRelevantContext) {
        await upsertRelevanceContextJob(conn, {
            mapDataId,
            pageId: mapDataEvent.pageId,
            pageSource: mapDataEvent.source,
        });
    }
};

export default applyUpsertedMapData;
