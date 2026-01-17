import * as db from 'zapatos/db';
import { RopewikiBetaSection } from '../types/page';

// Insert or update beta sections for a page.
// On conflict (same ropewikiPage & title), update the text and timestamps, including latestRevisionDate.
// Returns a map of title -> id for all upserted beta sections.
const upsertBetaSections = async (
    tx: db.Queryable,
    pageUuid: string,
    betaSections: RopewikiBetaSection[],
    latestRevisionDate: Date,
): Promise<{ [title: string]: string }> => {
    if (betaSections.length === 0) {
        return {};
    }

    const now = new Date();

    const rows = betaSections.map((betaSection) => ({
        ropewikiPage: pageUuid,
        title: betaSection.title,
        text: betaSection.text,
        order: betaSection.order,
        latestRevisionDate,
        updatedAt: now,
        deletedAt: null,
    }));

    const result = await db
        .upsert('RopewikiPageBetaSection', rows, ['ropewikiPage', 'title'], {
            updateColumns: ['text', 'order', 'latestRevisionDate', 'updatedAt', 'deletedAt'],
        })
        .run(tx);

    return Object.fromEntries(result.map(row => [row.title, row.id]));
};

export default upsertBetaSections;

