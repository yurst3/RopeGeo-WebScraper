/**
 * Daily job: build page download ZIP bundles for pages that are ready and missing downloadFolder.
 * Intended to run on ECS Fargate at 12:00 UTC daily.
 */

import type { PoolClient } from 'pg';
import getDatabaseConnection, { resetDatabaseConnectionPool } from '../../helpers/getDatabaseConnection';
import { processAllFolders } from './processors/processAllFolders';

export async function main(): Promise<void> {
    let pool;
    let client: PoolClient | undefined;
    try {
        pool = await getDatabaseConnection();
        client = await pool.connect();

        const result = await processAllFolders(client);
        if (result.total === 0) {
            console.log('No pages need download folder builds.');
            return;
        }

        console.log(
            `buildDownloadFolders complete: built=${result.built} skipped=${result.skipped} failed=${result.failed} total=${result.total}`,
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
