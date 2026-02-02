import { launchBrowser } from '../../helpers/browserLauncher';
import { RoadTripRyanRegion } from '../types/region';

const evalPage = (): RoadTripRyanRegion[] => {
    return[];
}

const parseRegions = async (html: string): Promise<RoadTripRyanRegion[]> => {
    const browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html);

    let result = await page.evaluate(evalPage);

    await browser.close();

    return result;
}
export default parseRegions;