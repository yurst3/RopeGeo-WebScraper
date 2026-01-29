import * as db from 'zapatos/db';
import RopewikiPage from '../types/page';
import { Route, RouteType } from '../../types/route';

type ResultRow = {
    ropewikiPage: string;
    routeId: string;
    routeName: string;
    routeType: string;
    routeCoordinates: unknown;
};

/**
 * Gets routes for an array of RopewikiPages.
 * Returns an array of [Route, RopewikiPage] tuples with the same length as the input pages.
 * If a page doesn't have a route, the Route in the tuple will be null.
 * 
 * @param conn - Database connection
 * @param pages - Array of RopewikiPage objects
 * @returns Promise that resolves to an array of [Route | null, RopewikiPage] tuples
 */
const getRoutesForPages = async (
    conn: db.Queryable,
    pages: RopewikiPage[],
): Promise<Array<[Route | null, RopewikiPage]>> => {
    if (pages.length === 0) {
        return [];
    }

    // Extract page IDs from pages that have IDs
    const pageUuids = pages.map(page => page.id).filter((id): id is string => id !== undefined);
    
    if (pageUuids.length === 0) {
        // If no pages have IDs, return all pages with null routes
        return pages.map(page => [null, page]);
    }

    // Query RopewikiRoute joined with Route to get routes for the pages
    const result = await db.sql<db.SQL, Array<ResultRow>>`
        SELECT 
            rr."ropewikiPage",
            r.id AS "routeId",
            r.name AS "routeName",
            r.type AS "routeType",
            r.coordinates AS "routeCoordinates"
        FROM "RopewikiRoute" rr
        INNER JOIN "Route" r ON rr.route = r.id
        WHERE rr."ropewikiPage" = ANY(${db.param(pageUuids)}::uuid[])
        AND rr."deletedAt" IS NULL
    `.run(conn);

    // Create a map of page ID to Route
    const routeMap = result.reduce((map: {[pageId: string]: Route}, row: ResultRow) => {
        const route = new Route(
            row.routeId,
            row.routeName,
            row.routeType as RouteType,
            row.routeCoordinates
        );
        map[row.ropewikiPage] = route;
        return map;
    }, {});

    // Return tuples maintaining the order of input pages
    return pages.map(page => {
        const route = page.id ? routeMap[page.id] ?? null : null;
        return [route, page] as [Route | null, RopewikiPage];
    });
};

export default getRoutesForPages;
