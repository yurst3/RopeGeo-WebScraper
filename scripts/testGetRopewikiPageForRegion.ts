import getDatabaseConnection from '../src/helpers/getDatabaseConnection';
import processRegions from '../src/ropewiki/processors/processRegions';
import getPagesForRegion from '../src/ropewiki/http/getPagesForRegion';

const LIMIT = 10;
const MAX_OFFSET = 5000;

/**
 * Script to test getPagesForRegion: loads regions for the regionNameIds mapping,
 * picks a random offset in [0, 5000 - limit], and fetches one page of the "World" region.
 * Usage: ts-node scripts/testGetRopewikiPageForRegion.ts
 * (Set DB_* env vars for processRegions, or use npm run test:get-ropewiki-page-for-region for local DB.)
 */
async function main() {
    const pool = await getDatabaseConnection();
    try {
        const regionNameIds = await processRegions(pool);
        const maxOffset = Math.max(0, MAX_OFFSET - LIMIT);
        const offset = Math.floor(Math.random() * (maxOffset + 1));
        console.log(`Calling getPagesForRegion("World", offset=${offset}, limit=${LIMIT})`);
        const pages = await getPagesForRegion('World', offset, LIMIT, regionNameIds);
        console.log(`Received ${pages.length} page(s):`);
        pages.forEach((p, i) => console.log(JSON.stringify(p, null, 4)));
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error('Error:', error);
        process.exit(1);
    });
}
