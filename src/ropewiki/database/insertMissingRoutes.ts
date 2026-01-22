import * as db from 'zapatos/db';
import RopewikiPage from '../types/page';
import { Route } from '../../types/route';
import zip from 'lodash/zip';

/**
 * Inserts missing routes for pages that don't have routes.
 * Creates Route objects from RopewikiPages using Route.fromRopewikiPage and inserts them into the database.
 * Returns an array of [Route, RopewikiPage] tuples where all routes are non-null.
 * 
 * @param conn - Database connection
 * @param routesAndPages - Array of [Route | null, RopewikiPage] tuples
 * @returns Promise that resolves to an array of [Route, RopewikiPage] tuples
 */
const insertMissingRoutes = async (
    conn: db.Queryable,
    routesAndPages: Array<[Route | null, RopewikiPage]>,
): Promise<Array<[Route, RopewikiPage]>> => {
    // Separate pages with routes from pages without routes
    const existingPagesWithRoutes: Array<[Route, RopewikiPage]> = [];
    const pagesWithoutRoutes: RopewikiPage[] = [];

    routesAndPages.forEach(([route, page]) => {
        if (!route) pagesWithoutRoutes.push(page);
        else existingPagesWithRoutes.push([route, page]);
    });

    // If no pages need routes, return early
    if (pagesWithoutRoutes.length === 0) {
        return existingPagesWithRoutes;
    }

    // Create Route objects from pages without routes
    const routesToInsert = pagesWithoutRoutes.map(page => {
        const route = Route.fromRopewikiPage(page);
        return route.toDbRow();
    });

    // Insert all routes in a single database operation
    const result = await db
        .insert('Route', routesToInsert)
        .run(conn);

    const routes = result.map(Route.fromDbRow);
    const newPagesAndRoutes = zip(routes, pagesWithoutRoutes) as Array<[Route, RopewikiPage]>;

    return existingPagesWithRoutes.concat(newPagesAndRoutes);
};

export default insertMissingRoutes;
