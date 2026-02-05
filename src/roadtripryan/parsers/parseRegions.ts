import { launchBrowser } from '../../helpers/browserLauncher';
import { RoadTripRyanRegion } from '../types/region';

const evalPage = (): RoadTripRyanRegion[] => {
    const regions: RoadTripRyanRegion[] = [];
    const topLevelArea: Element | null = document.querySelector(".topLevelArea");
    const cards = topLevelArea?.querySelectorAll(".card");

    const getRegion = (anchor: Element, parentRegion?: string): any => {
        const name: string = anchor.textContent;
        const href: string | undefined = anchor.attributes.getNamedItem('href')?.value;

        if (!href) {
            throw new Error("Anchor element is missing href attribute");
        }

        const url: string = "https://www.roadtripryan.com" + href;

        const pageCount = 0;

        return {name, parentRegion, pageCount, url};
    }

    const getRegionsForCard = (card: Element): any[] => {
        const cardTitle = card.querySelector(".card-title");
        const anchor = cardTitle?.children[0];
        if (!anchor) {
            return [];
        }
        const region = getRegion(anchor);

        return[region];
    }
    cards?.forEach(card => regions.push(...getRegionsForCard(card)))

    return regions;
}

const parseRegions = async (html: string): Promise<RoadTripRyanRegion[]> => {
    const browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    let result = await page.evaluate(evalPage);

    await browser.close();

    return result;
}
export default parseRegions;