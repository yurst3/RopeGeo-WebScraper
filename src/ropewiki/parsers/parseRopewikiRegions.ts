import puppeteer from 'puppeteer';
import { RopewikiRegion } from '../types/ropewiki';
import { v5 as uuidV5 } from 'uuid';
import uniqBy from 'lodash/uniqBy';
import { launchBrowser } from '../../helpers/browserLauncher';

const NAMESPACE = 'b93540f1-7091-46f5-95d2-94b6c418e563';

type partialRegion = Omit<RopewikiRegion, "id">;

/*
HTML elements look something like this:

<ul class="collapsibleList optionform regioncount notranslate">
    <ul>
        <li>
            <a href="/World" title="World">World</a>
            <ul>
                <li>
                    <a href="/Africa" title="Africa">Africa</a>
                    <ul>...</ul>
                </li>
                <li>...</li>
                <li>...</li>
                <li>...</li>
                <li>...</li>
                <li>...</li>
                <li>...</li>
                <li>...</li>
            </ul>
        </li>
    </ul>
</ul>
*/
const evalPage = () => {
    // parseRegion() has to be defined inside evalPage() because it is being run in a browser context and can't reference other functions
    const parseRegion = (
        unorderedListElement: ChildNode,
        regions: partialRegion[],
        parentRegion: string | undefined
    ) => {
        const listItems = unorderedListElement.childNodes;
        listItems.forEach((node: ChildNode) => {
            if (node.nodeName === '#text') return; // I'm not quite sure why these #text child nodes are being included, let's just ignore them
            const name: string | null | undefined = node.childNodes[0]?.textContent;
            if (!name) return;
            const unorderedListElement: ChildNode | undefined = node.childNodes[2];
    
            regions.push({ name, parentRegion });
            if (unorderedListElement) parseRegion(unorderedListElement, regions, name);
        });
    }

    const regions: partialRegion[] = [];
    const unorderedListElement: ChildNode | undefined = document.querySelector('.collapsibleList')?.childNodes[1];
    if (unorderedListElement) parseRegion(unorderedListElement, regions, undefined);
    return regions;
}

// Use puppeteer headless browser to help parse the regions from https://ropewiki.com/Regions html. 
const parseRopewikiRegions = async (html: string): Promise<RopewikiRegion[]> => {
    const browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html);

    // Puppeteer doesn't play nice with the uuid module, so we have to assign uuids outside of evaluate()
    const partialRegions = await page.evaluate(evalPage);
    const regionIdMap: {[name: string]: string} = Object.fromEntries(partialRegions.map(partial => 
        [
            partial.name,
            uuidV5(partial.name + (partial.parentRegion || ''), NAMESPACE),
        ]
    ));
    const regions: RopewikiRegion[] = partialRegions.map(partial => {
        return {
            id: uuidV5(partial.name + (partial.parentRegion || ''), NAMESPACE),
            name: partial.name,
            parentRegion: partial.parentRegion ? regionIdMap[partial.parentRegion] : undefined,
        }
    });

    await browser.close();

    // Make sure there is only one of each name-parent combo
    return uniqBy(regions, region => `${region.name}-${region.parentRegion}`);
}

export default parseRopewikiRegions;