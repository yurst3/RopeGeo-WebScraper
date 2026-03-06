import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { RopewikiBetaSection } from '../types/betaSection';
import { makeUnnestPart } from '../../helpers/makeUnnestPart';

// Insert or update beta sections for a page.
// ON CONFLICT (ropewikiPage, title) DO UPDATE SET ... WHERE allowUpdates = true.
// Returns a map of title -> id only for beta sections that were actually inserted or updated (locked rows are not included).
const upsertBetaSections = async (
    tx: db.Queryable,
    pageUuid: string,
    betaSections: RopewikiBetaSection[],
    latestRevisionDate: Date,
): Promise<{ [title: string]: string }> => {
    if (betaSections.length === 0) return {};

    const columns = RopewikiBetaSection.getDbInsertColumns();
    const rows = betaSections.map((b) => b.toDbRow(pageUuid, latestRevisionDate));
    const unnestPart = makeUnnestPart(RopewikiBetaSection, rows);

    const returned = await db.sql<
        db.SQL,
        (s.RopewikiBetaSection.JSONSelectable)[]
    >`
        INSERT INTO "RopewikiBetaSection" ( ${db.cols(columns)} )
        SELECT * FROM unnest( ${unnestPart} ) AS t( ${db.cols(columns)} )
        ON CONFLICT ("ropewikiPage", "title") DO UPDATE SET
            "text" = EXCLUDED."text",
            "order" = EXCLUDED."order",
            "latestRevisionDate" = EXCLUDED."latestRevisionDate",
            "updatedAt" = EXCLUDED."updatedAt",
            "deletedAt" = EXCLUDED."deletedAt"
        WHERE "RopewikiBetaSection"."allowUpdates" = true
        RETURNING id, title
    `.run(tx);

    return Object.fromEntries(returned.map((row) => [row.title, row.id]));
};

export default upsertBetaSections;
