import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';

export type RopewikiPageRelevanceSourceData = {
    page: s.RopewikiPage.JSONSelectable;
    betaSections: Pick<
        s.RopewikiBetaSection.JSONSelectable,
        'id' | 'title' | 'text' | 'order'
    >[];
    images: Pick<
        s.RopewikiImage.JSONSelectable,
        'id' | 'betaSection' | 'caption' | 'order'
    >[];
};

/**
 * Loads Ropewiki page, active beta sections, and active images used as relevance-model input.
 * Throws if the page does not exist.
 */
const getRopewikiPageRelevanceSourceData = async (
    conn: db.Queryable,
    pageId: string,
): Promise<RopewikiPageRelevanceSourceData> => {
    const page = await db.selectOne('RopewikiPage', { id: pageId }).run(conn);
    if (page == null) {
        throw new Error(`RopewikiPage not found: ${pageId}`);
    }

    const [betaSections, images] = await Promise.all([
        db
            .select(
                'RopewikiBetaSection',
                { ropewikiPage: pageId, deletedAt: db.conditions.isNull },
                { columns: ['id', 'title', 'text', 'order'], order: { by: 'order', direction: 'ASC' } },
            )
            .run(conn),
        db
            .select(
                'RopewikiImage',
                { ropewikiPage: pageId, deletedAt: db.conditions.isNull },
                {
                    columns: ['id', 'betaSection', 'caption', 'order'],
                    order: { by: 'order', direction: 'ASC' },
                },
            )
            .run(conn),
    ]);

    return { page, betaSections, images };
};

export default getRopewikiPageRelevanceSourceData;
