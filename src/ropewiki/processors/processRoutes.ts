import { Queryable } from "zapatos/db";
import updateRouteForPage from "../database/updateRouteForPage";
import filterUpsertedPages from "../util/filterUpsertedPages";
import RopewikiPage from "../types/page";
import { Route } from "../../types/route";
import getRoutesForPages from "../database/getRoutesForPages";
import correlateExistingRoutes from "../util/correlateExistingRoutes";
import insertMissingRoutes from "../database/insertMissingRoutes";
import type { ProcessRopewikiRoutesHookFn } from "../hook-functions/processRopewikiRoutes";
import RopewikiRoute from "../../types/pageRoute";
import upsertRopewikiRoutes from "../database/upsertRopewikiRoutes";

const processRoutes = async (
    conn: Queryable,
    upsertedPages: RopewikiPage[],
    processRopewikiRoutesHookFn: ProcessRopewikiRoutesHookFn,
) => {
    // Routes need coordinates, not all upserted pages have coordinates
    const pagesWithCoords = filterUpsertedPages(upsertedPages);

    // Some pages might not have routes for them
    let routesAndPages: Array<[Route | null, RopewikiPage]> = await getRoutesForPages(conn, pagesWithCoords);

    // Find routes which were created by other scrapers that match the ropewiki pages
    routesAndPages = await correlateExistingRoutes(conn, routesAndPages);

    // Update all existing routes to have the same info as the ropewiki page
    await Promise.all(
        routesAndPages.filter(([route,]) => route !== null)
            .map(([,page]) => updateRouteForPage(conn, page))
    );

    // Insert routes for pages that don't have routes
    const allRoutesAndPages: Array<[Route, RopewikiPage]> = await insertMissingRoutes(conn, routesAndPages);

    // Upsert the ropewiki routes before processing the map data so we don't have any race conditions down the road
    const ropewikiRoutes: RopewikiRoute[] = await upsertRopewikiRoutes(conn, allRoutesAndPages);

    // Process routes using the hook function (Node.js processes directly, Lambda sends to SQS)
    await processRopewikiRoutesHookFn(ropewikiRoutes);
}

export default processRoutes;