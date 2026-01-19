import getPagesWithCoordinates from "../database/getPagesWithCoordinates";
import { Queryable } from "zapatos/db";
import getPagesWithRoutes from "../database/getPagesWithRoutes";
import updatePageRoute from "../database/updatePageRoute";
import getPagesWithoutRoutes from "../database/getPagesWithoutRoutes";
import insertRoutesForPages from "../database/insertRoutesForPages";

const processRoutes = async (conn: Queryable, upsertedPageUuids: string[]) => {
    // Routes need coordinates, not all upserted pages have coordinates
    const pagesWithCoords = await getPagesWithCoordinates(conn, upsertedPageUuids);

    // All of the pages with routes need to update their Routes' name, coords, and updatedAt time
    const pagesWithRoutes = await getPagesWithRoutes(conn, pagesWithCoords);
    await Promise.all(pagesWithRoutes.map(page => updatePageRoute(conn, page)));

    // All of the pages without routes need to create a Route
    const pagesWithoutRoutes = await getPagesWithoutRoutes(conn, pagesWithCoords);
    const insertedRoutes = await insertRoutesForPages(conn, pagesWithoutRoutes);

    // Link the routes to the pages and create a vector tile if applicable
    for (const [routeId, pageId] of insertedRoutes) {

    }
}

export default processRoutes;