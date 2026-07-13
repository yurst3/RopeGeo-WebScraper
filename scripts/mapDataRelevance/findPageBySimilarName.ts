import * as db from 'zapatos/db';
import type { PageMatch } from '../../src/map-data/types/relevanceTypes';

type SimilarPageRow = {
    id: string;
    name: string;
    similarityScore: number;
};

export async function findPageBySimilarName(
    conn: db.Queryable,
    name: string,
): Promise<PageMatch | undefined> {
    const rows = await db.sql<db.SQL, SimilarPageRow[]>`
        SELECT
            p.id,
            p.name,
            word_similarity(${db.param(name)}, p.name)::float AS "similarityScore"
        FROM "RopewikiPage" p
        WHERE p."deletedAt" IS NULL
        ORDER BY "similarityScore" DESC, p.name ASC
        LIMIT 1
    `.run(conn);

    const row = rows[0];
    if (row == null) return undefined;
    return {
        id: row.id,
        name: row.name,
        similarityScore: row.similarityScore,
    };
}
