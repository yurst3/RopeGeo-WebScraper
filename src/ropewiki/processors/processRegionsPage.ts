import getRopewikiPageHtml from "../http/getRopewikiPageHtml";
import getRopewikiPagesRevisionDates from "../http/getRopewikiPageRevisionDate";
import getUpdatedDateForRegions from "../database/getUpdatedDateForRegions";
import { Queryable } from "zapatos/db";
import parseRopewikiRegions from "../parsers/parseRopewikiRegions";
import { RopewikiRegion } from "../types/ropewiki";
import upsertRegions from "../database/upsertRegions";
import type * as s from 'zapatos/schema';
import getRegions from "../database/getRegions";

const REGIONS_PAGE_ID = '5597';

const processRegionsPage = async (conn: Queryable): Promise<{[name: string]: string}> => {
    console.log('Pulling the latest revision date for the Ropewiki Regions page HTML...')
    const regionsPageRevisionDate = (await getRopewikiPagesRevisionDates([REGIONS_PAGE_ID]))[REGIONS_PAGE_ID];
    if (!regionsPageRevisionDate) throw new Error('Error getting Regions page revision date');
    const updatedAt: Date | null = await getUpdatedDateForRegions(conn);

    let regions: RopewikiRegion[] | s.RopewikiRegion.JSONSelectable[];
    if (!updatedAt || updatedAt < regionsPageRevisionDate) {
        if (!updatedAt) console.log('No updatedAt date found for regions in database, pulling Ropewiki Regions page HTML...');
        else {
            const timeDiff: number = Math.round((regionsPageRevisionDate.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
            console.log(`Latest revision of the Ropewiki Regions page was made ${timeDiff} days after the last update in our database, pulling the page HTML...`);
        }

        const regionsPageHTML: string = await getRopewikiPageHtml(REGIONS_PAGE_ID);

        console.log('Retrieved the Ropewiki Regions page HTML, parsing HTML into regions objects...');
        regions = await parseRopewikiRegions(regionsPageHTML);

        console.log('Parsed regions objects, upserting into the database...');
        await upsertRegions(conn, regions, regionsPageRevisionDate);
    } else {
        const timeDiff: number = Math.round((updatedAt.getTime() - regionsPageRevisionDate.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`Latest revision of the Ropewiki Regions page was made ${timeDiff} days prior to the last update in our database, skipping regions upsert...`)
        regions = await getRegions(conn); 
    }

    return Object.fromEntries(
        regions.map(
            (region: RopewikiRegion | s.RopewikiRegion.JSONSelectable) => [region.name, region.id]
        )
    );
}

export default processRegionsPage;