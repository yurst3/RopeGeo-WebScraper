import * as db from 'zapatos/db';

/**
 * Returns true if a non-deleted route exists with the given id.
 */
const routeExists = async (conn: db.Queryable, routeId: string): Promise<boolean> => {
    const row = await db
        .selectOne('Route', { id: routeId, deletedAt: db.conditions.isNull })
        .run(conn);
    return row != null;
};

export default routeExists;
