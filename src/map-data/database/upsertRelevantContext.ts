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
    await db
        .upsert(
            'MapDataRelevantContext',
            {
                mapDataId,
                legendItemId,
                jobId,
                measurements: context.measurements as db.JSONValue | null,
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
