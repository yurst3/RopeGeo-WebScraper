/**
 * One-shot Fargate task: backfill RopewikiPage / RopewikiImage / MapData authors.
 * Delete this task (code + CloudFormation) after a successful run.
 */

import getDatabaseConnection, {
    resetDatabaseConnectionPool,
} from '../../helpers/getDatabaseConnection';
import { backfillAllAttribution } from './processors/backfillAllAttribution';

export async function main(): Promise<void> {
    let pool;
    let client;
    try {
        pool = await getDatabaseConnection();
        client = await pool.connect();
        const summary = await backfillAllAttribution(client);
        console.log(
            `backfillAttribution complete: pages=${summary.pagesUpdated}/${summary.pagesAttempted} ` +
                `images=${summary.imagesUpdated}/${summary.imagesAttempted} ` +
                `mapData=${summary.mapDataUpdated}/${summary.mapDataAttempted} ` +
                `errors=${summary.errors}`,
        );
    } catch (err) {
        console.error(err);
        throw err;
    } finally {
        client?.release();
        await resetDatabaseConnectionPool();
    }
}

if (require.main === module) {
    main().then(
        () => process.exit(0),
        (err) => {
            console.error(err);
            process.exit(1);
        },
    );
}
