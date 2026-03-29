import type * as s from 'zapatos/schema';
import getDatabaseConnection from '../src/helpers/getDatabaseConnection';
import RopewikiPage from '../src/ropewiki/types/page';
import { processPage } from '../src/ropewiki/processors/processPage';
import ProgressLogger from 'ropegeo-common/helpers/progressLogger';

/**
 * Script to process a random RopewikiPage from the database.
 * Usage: ts-node processRopewikiPage.ts
 */
async function main() {
    const pool = await getDatabaseConnection();
    const client = await pool.connect();

    try {
        const result = await pool.query(
            `SELECT * FROM "RopewikiPage"
             WHERE "deletedAt" IS NULL
             ORDER BY RANDOM()
             LIMIT 1`
        );
        const rows = result.rows as s.RopewikiPage.JSONSelectable[];

        if (rows.length === 0) {
            throw new Error('No pages found in the database');
        }

        const page = RopewikiPage.fromDbRow(rows[0]!);
        console.log(`Selected page - ID: ${page.id}, Name: ${page.name}`);

        await client.query('BEGIN');

        const logger = new ProgressLogger('Process Ropewiki page', 1);
        logger.setChunk(0, 1);

        await processPage(client, page, logger, 'processRopewikiPage');

        await client.query('COMMIT');
        console.log('Page processing complete.');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error('Error:', error);
        process.exit(1);
    });
}
