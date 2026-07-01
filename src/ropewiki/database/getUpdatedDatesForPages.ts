import * as db from 'zapatos/db';

const getUpdatedDatesForPages = async (
    conn: db.Queryable,
    externalPageIds: string[],
): Promise<{ [externalPageId: string]: Date | null }> => {
    if (externalPageIds.length === 0) return {};

    const rows: db.JSONOnlyColsForTable<"RopewikiPage", ("updatedAt" | "externalPageId")[]>[] = await db.select(
        'RopewikiPage',
        { externalPageId: db.conditions.isIn(externalPageIds) },
        { columns: ['externalPageId', 'updatedAt'] }
    ).run(conn);

    const foundPages: { [externalPageId: string]: Date | null } = Object.fromEntries(rows.map(row => [
        row.externalPageId as string,
        new Date(row.updatedAt)
    ]));

    externalPageIds.forEach(externalPageId => {
        if (!foundPages[externalPageId]) foundPages[externalPageId] = null;
    });

    return foundPages;
};

export default getUpdatedDatesForPages;
