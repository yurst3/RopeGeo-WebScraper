import getLengthAndElevGains from '../http/getLengthAndElevGains';
import RopewikiPage from '../types/page';

/**
 * Fetches length and elevation-gain data for pages that need it,
 * and sets the values on the corresponding page objects (mutates in place).
 * Only pages for which {@link RopewikiPage.needsLengthUpdates} returns true
 * are requested; results are applied to any page that has data in the response.
 *
 * @param pages - Valid RopewikiPage instances to update
 */
async function updateLengthsForPages(pages: RopewikiPage[]): Promise<void> {
    const pagesNeedingLengthUpdates = pages.filter((p) => p.needsLengthUpdates());
    if (pagesNeedingLengthUpdates.length === 0) return;

    const pageids = pagesNeedingLengthUpdates.map((p) => p.pageid);
    const lengthMap = await getLengthAndElevGains(pageids);

    for (const page of pages) {
        const data = lengthMap[page.pageid];
        if (data) page.setLengthsAndElevGains(data);
    }
}

export default updateLengthsForPages;
