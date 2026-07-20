import type { Queryable } from 'zapatos/db';
import { getRopewikiMapDataAuthors } from '../../../map-data/hook-functions/getRopewikiMapDataAuthors';
import getMapDataNeedingAuthors, {
    type MapDataNeedingAuthors,
} from '../database/getMapDataNeedingAuthors';
import updateMapDataAuthors from '../database/updateMapDataAuthors';
import {
    BACKFILL_BATCH_SIZE,
    BACKFILL_INTER_BATCH_DELAY_MS,
} from '../util/constants';
import runInBatches from '../util/runInBatches';
import {
    addMapDataBackfillCounts,
    emptyMapDataBackfillCounts,
    type MapDataBackfillCounts,
} from '../util/mapDataBackfillCounts';

async function backfillOneMapData(
    conn: Queryable,
    row: MapDataNeedingAuthors,
): Promise<MapDataBackfillCounts> {
    try {
        const authors = await getRopewikiMapDataAuthors(row.sourceFileUrl);
        await updateMapDataAuthors(conn, row.id, authors);
        return { mapDataAttempted: 1, mapDataUpdated: 1, errors: 0 };
    } catch (err) {
        console.error(
            `backfill MapData ${row.id} failed: ${
                err instanceof Error ? err.message : String(err)
            }`,
        );
        return { mapDataAttempted: 1, mapDataUpdated: 0, errors: 1 };
    }
}

export async function backfillMapDataAuthors(
    conn: Queryable,
): Promise<MapDataBackfillCounts> {
    const rows = await getMapDataNeedingAuthors(conn);
    const batchCounts = await runInBatches(
        rows,
        BACKFILL_BATCH_SIZE,
        (row) => backfillOneMapData(conn, row),
        BACKFILL_INTER_BATCH_DELAY_MS,
    );
    return batchCounts.reduce(addMapDataBackfillCounts, emptyMapDataBackfillCounts());
}

export default backfillMapDataAuthors;
