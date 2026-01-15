import { launchBrowser } from '../helpers/browserLauncher'
import getPageHtml from './http/getPageHtml';
import parseCanyonsPage from './parsers/parseCanyonsPage';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const roadTripRyanScraperHandler = async (event: unknown, context: any) => {
    console.log('Road Trip Ryan Scraper');

    const pageHtml = await getPageHtml("https://www.roadtripryan.com/go/type/canyon");
    const canyons = await parseCanyonsPage(pageHtml);

};

roadTripRyanScraperHandler({},{})

// Allow running as a Node.js script (not just Lambda handler)
// if (require.main === module) {
//     roadTripRyanScraperHandler({}, {}).then(() => {
//         process.exit(0);
//     }).catch((error) => {
//         console.error('Error:', error);
//         process.exit(1);
//     });
// }