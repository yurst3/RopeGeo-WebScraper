import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import type { RelevantContextDbJson } from '../util/contextToDbJson';

export type RelevantContextRow = s.MapDataRelevantContext.JSONSelectable;

const upsertRelevantContext = async (
    conn: db.Queryable,
    mapDataId: string,
    legendItemId: string,
    jobId: string,
    context: RelevantContextDbJson,
): Promise<void> => {
    const now = new Date();
    // node-pg treats top-level JS arrays as Postgres arrays; cast measurements for jsonb.
    const measurements =
        context.measurements == null
            ? null
            : db.param(context.measurements as db.JSONValue, true);
    await db
        .upsert(
            'MapDataRelevantContext',
            {
                mapDataId,
                legendItemId,
                jobId,
                measurements,
                betaSectionExcerpts: context.betaSectionExcerpts as db.JSONValue | null,
                images: context.images as db.JSONValue | null,
                updatedAt: now,
                deletedAt: null,
            },
            ['mapDataId', 'legendItemId'],
            {
                updateColumns: [
                    'jobId',
                    'measurements',
                    'betaSectionExcerpts',
                    'images',
                    'updatedAt',
                    'deletedAt',
                ],
            },
        )
        .run(conn);
};

export default upsertRelevantContext;
