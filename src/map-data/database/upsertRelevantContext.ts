import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import type { RelevantContextDbJson } from '../util/contextToDbJson';

export type RelevantContextRow = s.MapDataRelevantContext.JSONSelectable;

/** node-pg treats top-level JS arrays as Postgres arrays; force jsonb serialization. */
function jsonbArrayParam(
    value: RelevantContextDbJson['measurements'] | RelevantContextDbJson['images'],
): db.Parameter<db.JSONValue> | null {
    if (value == null) return null;
    return db.param(value as db.JSONValue, true);
}

const upsertRelevantContext = async (
    conn: db.Queryable,
    mapDataId: string,
    legendItemId: string,
    jobId: string,
    context: RelevantContextDbJson,
): Promise<void> => {
    const now = new Date();
    await db
        .upsert(
            'MapDataRelevantContext',
            {
                mapDataId,
                legendItemId,
                jobId,
                measurements: jsonbArrayParam(context.measurements),
                betaSectionExcerpts: context.betaSectionExcerpts as db.JSONValue | null,
                images: jsonbArrayParam(context.images),
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
