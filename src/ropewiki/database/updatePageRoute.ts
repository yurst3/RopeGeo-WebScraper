import * as db from 'zapatos/db';
import RopewikiPage from '../types/page';

const updatePageRoute = async (
    conn: db.Queryable,
    page: RopewikiPage,
): Promise<void> => {
    if (!page.id) {
        throw new Error('Page must have an id to update route');
    }

    if (!page.coordinates) {
        throw new Error('Page must have coordinates to update route');
    }

    const now = new Date();

    // Update the Route table for the route linked to the given page
    // Using a subquery to find the route ID from RopewikiRoute
    await db.sql<db.SQL>`
        UPDATE "Route" r
        SET 
            "name" = ${db.param(page.name)},
            "coordinates" = ${db.param(page.coordinates)}::jsonb,
            "updatedAt" = ${db.param(now)}
        FROM "RopewikiRoute" rr
        WHERE r.id = rr.route
        AND rr."ropewikiPage" = ${db.param(page.id)}::uuid
        AND rr."deletedAt" IS NULL
    `.run(conn);
};

export default updatePageRoute;
