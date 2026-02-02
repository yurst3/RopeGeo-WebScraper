import getPageHtml from './http/getPageHtml';
import parseCanyonsPage from './parsers/parseCanyonsPage';
import processRegions from './processors/processRegions';

export const main = async () => {
    console.log('Road Trip Ryan Scraper');

    const pageHtml = await getPageHtml("https://www.roadtripryan.com/go/type/canyon");
    const canyons = await parseCanyonsPage(pageHtml);

};

main()

// Allow running as a Node.js script (not just Lambda handler)
// if (require.main === module) {
//     roadTripRyanScraperHandler({}, {}).then(() => {
//         process.exit(0);
//     }).catch((error) => {
//         console.error('Error:', error);
//         process.exit(1);
//     });
// }