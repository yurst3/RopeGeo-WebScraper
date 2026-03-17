import type { Pool, PoolClient } from 'pg';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import getAllPages from '../database/getAllPages';
import processRoutes from '../processors/processRoutes';
import { lambdaProcessRopewikiRoutesForReprocessor } from '../hook-functions/processRopewikiRoutes';

export const reprocessRoutesHandler = async () => {
    let pool: Pool | undefined; 
    let client: PoolClient | undefined;

    try {
        pool = await getDatabaseConnection();
        client = await pool.connect();

        const pages = await getAllPages(client);

        console.log(`Reprocessing routes for all ${pages.length} pages...`)

        await processRoutes(client, pages, lambdaProcessRopewikiRoutesForReprocessor);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Ropewiki route reprocessor completed successfully',
            }),
        };
    } catch (error) {
        console.error('Error in Ropewiki route reprocessor:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Ropewiki route reprocessor failed',
                error: error instanceof Error ? error.message : String(error),
            }),
        };
    } finally {
        if (client) client.release();
        if (pool) await pool.end();
    }
};
