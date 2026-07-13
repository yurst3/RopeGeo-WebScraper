import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { RelevantContext } from 'ropegeo-common/models';

export type RelevantContextByLegendItemId = Map<string, RelevantContext>;

function rowToRelevantContext(row: s.MapDataRelevantContext.JSONSelectable): RelevantContext {
    return RelevantContext.fromResult({
        measurements: row.measurements ?? [],
        betaSectionExcerpts: row.betaSectionExcerpts ?? {},
        images: row.images ?? {},
    });
}

const getRelevantContextByMapDataId = async (
    conn: db.Queryable,
    mapDataId: string,
): Promise<RelevantContextByLegendItemId> => {
    const rows = await db
        .select('MapDataRelevantContext', {
            mapDataId,
            deletedAt: db.conditions.isNull,
        })
        .run(conn);

    const out: RelevantContextByLegendItemId = new Map();
    for (const row of rows) {
        try {
            out.set(row.legendItemId, rowToRelevantContext(row));
        } catch (error) {
            console.warn(
                `getRelevantContextByMapDataId: skipping invalid context for legend item ${row.legendItemId}:`,
                error instanceof Error ? error.message : error,
            );
        }
    }
    return out;
};

export default getRelevantContextByMapDataId;
