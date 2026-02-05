import proccessRegions from './processors/processRegions';

export const main = async () => {
    console.log('Road Trip Ryan Scraper');

    const regions = await proccessRegions();

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