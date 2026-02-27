import { Queryable } from "zapatos/db";
import updateRouteForPage from "../database/updateRouteForPage";
import filterUpsertedPages from "../util/filterUpsertedPages";
import RopewikiPage from "../types/page";
import { Route } from "ropegeo-common";
import getRoutesForPages from "../database/getRoutesForPages";
import correlateExistingRoutes from "../util/correlateExistingRoutes";
import insertMissingRoutes from "../database/insertMissingRoutes";
import type { ProcessRopewikiRoutesHookFn } from "../hook-functions/processRopewikiRoutes";
import RopewikiRoute from "../../types/pageRoute";
import upsertRopewikiRoutes from "../database/upsertRopewikiRoutes";
import filterRopewikiRoutesWithMapData from "../util/filterRopewikiRoutesWithMapData";

const processRoutes = async (
    conn: Queryable,
    upsertedPages: RopewikiPage[],
    processRopewikiRoutesHookFn: ProcessRopewikiRoutesHookFn,
) => {
    // Routes need coordinates, not all upserted pages have coordinates
    const pagesWithCoords = filterUpsertedPages(upsertedPages);

    console.log(`Upserting routes for ${pagesWithCoords.length} of ${upsertedPages.length} updated pages...`);

    // Some pages might not have routes for them
    let routesAndPages: Array<[Route | null, RopewikiPage]> = await getRoutesForPages(conn, pagesWithCoords);

    // Find routes which were created by other scrapers that match the ropewiki pages
    routesAndPages = await correlateExistingRoutes(conn, routesAndPages);

    // Update all existing routes to have the same info as the ropewiki page
    await Promise.all(
        routesAndPages.filter(([route,]) => route !== null)
            .map(([,page]) => updateRouteForPage(conn, page))
    );

    console.log(`Updated ${routesAndPages.filter(([route,]) => route !== null).length} existing routes, creating ${routesAndPages.filter(([route,]) => !route).length} new routes...`);

    // Insert routes for pages that don't have routes
    const allRoutesAndPages: Array<[Route, RopewikiPage]> = await insertMissingRoutes(conn, routesAndPages);

    console.log(`Upserting ${allRoutesAndPages.length} RopewikiRoutes...`);

    // Upsert the ropewiki routes before processing the map data so we don't have any race conditions down the road
    const ropewikiRoutes: RopewikiRoute[] = await upsertRopewikiRoutes(conn, allRoutesAndPages);

    // We only want to process ropewiki routes with map data in their pages
    const ropewikiRoutesWithMapData = await filterRopewikiRoutesWithMapData(conn, ropewikiRoutes);

    // Process routes using the hook function (Node.js processes directly, Lambda sends to SQS)
    await processRopewikiRoutesHookFn(ropewikiRoutesWithMapData);
}

export default processRoutes;