import getPageHtml from "../http/getPageHtml";
import parseRegions from "../parsers/parseRegions";

const REGIONS_URL = "https://www.roadtripryan.com/go/trips/";

const processRegions = async () => {
    const pageHtml = await getPageHtml(REGIONS_URL);
    const regions = await parseRegions(pageHtml);
    console.log(regions);
}

export default processRegions;