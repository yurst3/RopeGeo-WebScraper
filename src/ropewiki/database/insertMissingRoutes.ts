import * as db from 'zapatos/db';
import RopewikiPage from '../types/page';
import { Route } from 'ropegeo-common/models';
import { routeFromDbRow, routeFromRopewikiPage, routeToDbRow } from '../../converters/route';
import { coordinatesKey, pickMostPopularPage } from '../util/pagePopularity';

/**
 * Inserts missing routes for pages that don't have routes.
 * Pages that share the same coordinates get a single shared Route, named after the
 * most popular page in the group (quality × userVotes; ties keep the first page).
 * Returns an array of [Route, RopewikiPage] tuples where all routes are non-null
 * (existing pairs first, then newly inserted pairs in input order).
 */
const insertMissingRoutes = async (
    conn: db.Queryable,
    routesAndPages: Array<[Route | null, RopewikiPage]>,
): Promise<Array<[Route, RopewikiPage]>> => {
    const existingPagesWithRoutes: Array<[Route, RopewikiPage]> = [];
    const pagesWithoutRoutes: RopewikiPage[] = [];

    routesAndPages.forEach(([route, page]) => {
        if (!route) pagesWithoutRoutes.push(page);
        else existingPagesWithRoutes.push([route, page]);
    });

    if (pagesWithoutRoutes.length === 0) {
        return existingPagesWithRoutes;
    }

    // Group pages that need routes by exact coordinates
    const groups = new Map<string, RopewikiPage[]>();
    const groupOrder: string[] = [];

    for (const page of pagesWithoutRoutes) {
        if (!page.coordinates) {
            throw new Error(`Page ${page.id ?? page.externalPageId} must have coordinates to insert a route`);
        }
        const key = coordinatesKey(page.coordinates);
        const existing = groups.get(key);
        if (existing) {
            existing.push(page);
        } else {
            groups.set(key, [page]);
            groupOrder.push(key);
        }
    }

    // One route per coordinate group, named for the most popular page in that group
    const routesToInsert = groupOrder.map((key) => {
        const pages = groups.get(key)!;
        const canonical = pickMostPopularPage(pages);
        return routeToDbRow(routeFromRopewikiPage(canonical));
    });

    const result = await db
        .insert('Route', routesToInsert)
        .run(conn);

    const routeByCoordsKey = new Map<string, Route>();
    groupOrder.forEach((key, index) => {
        routeByCoordsKey.set(key, routeFromDbRow(result[index]!));
    });

    const newPagesAndRoutes: Array<[Route, RopewikiPage]> = pagesWithoutRoutes.map((page) => {
        const route = routeByCoordsKey.get(coordinatesKey(page.coordinates!));
        if (!route) {
            throw new Error(`Missing inserted route for page ${page.id ?? page.externalPageId}`);
        }
        return [route, page];
    });

    return existingPagesWithRoutes.concat(newPagesAndRoutes);
};

export default insertMissingRoutes;
