import { Queryable } from "zapatos/db";
import upsertRegions from "../database/upsertRegions";
import getRegions from "../http/getRegions";

const processRegions = async (conn: Queryable): Promise<{[name: string]: string}> => {
    console.log('Fetching regions from Ropewiki API...');
    const regions = await getRegions();

    console.log(`Fetched ${regions.length} regions from API, upserting into the database...`);
    const upsertedRegions = await upsertRegions(conn, regions);

    // Create mapping of region names to IDs
    const regionNameIds: {[name: string]: string} = Object.fromEntries(
        upsertedRegions
            .filter((region) => region.id)
            .map((region) => [region.name, region.id!])
    );

    return regionNameIds;
}

export default processRegions;