import { Queryable } from "zapatos/db";
import updateRouteForPage from "../database/updateRouteForPage";
import filterUpsertedPages from "../util/filterUpsertedPages";
import RopewikiPage from "../types/page";
import { Route } from "ropegeo-common/models";
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

    // Reuse existing routes that already sit on the same coordinates
    routesAndPages = await correlateExistingRoutes(conn, routesAndPages);

    const existingCount = routesAndPages.filter(([route]) => route !== null).length;
    const missingCount = routesAndPages.filter(([route]) => route === null).length;
    console.log(`Found ${existingCount} existing routes (including coordinate matches), creating routes for ${missingCount} pages...`);

    // Insert routes for pages that don't have routes (one route per unique coordinates)
    const allRoutesAndPages: Array<[Route, RopewikiPage]> = await insertMissingRoutes(conn, routesAndPages);

    console.log(`Upserting ${allRoutesAndPages.length} RopewikiRoutes...`);

    // Link pages to routes before naming so popularity can consider every linked page
    const ropewikiRoutes: RopewikiRoute[] = await upsertRopewikiRoutes(conn, allRoutesAndPages);

    // Update each distinct route once from the most popular linked page
    const pagesByRouteId = new Map<string, RopewikiPage>();
    for (const [route, page] of allRoutesAndPages) {
        if (!pagesByRouteId.has(route.id)) {
            pagesByRouteId.set(route.id, page);
        }
    }
    await Promise.all(
        Array.from(pagesByRouteId.values()).map((page) => updateRouteForPage(conn, page)),
    );

    // We only want to process ropewiki routes with map data in their pages
    const ropewikiRoutesWithMapData = await filterRopewikiRoutesWithMapData(conn, ropewikiRoutes);

    // Process routes using the hook function (Node.js processes directly, Lambda sends to SQS)
    await processRopewikiRoutesHookFn(ropewikiRoutesWithMapData);
}

export default processRoutes;
