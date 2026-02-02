import { launchBrowser } from '../../helpers/browserLauncher';
import { RoadTripRyanRegion } from '../types/region';

const evalPage = (): RoadTripRyanRegion[] => {
    const regions: RoadTripRyanRegion[] = [];
    const topLevelArea: Element | null = document.querySelector(".topLevelArea");
    const cards = topLevelArea?.querySelectorAll(".card");

    const getRegionsForCard = (card: Element): RoadTripRyanRegion[] => {
        
        return[];
    }
    cards?.forEach(card => regions.push(...getRegionsForCard(card)))

    return regions;
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