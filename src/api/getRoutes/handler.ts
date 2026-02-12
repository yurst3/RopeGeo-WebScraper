import type { PoolClient } from 'pg';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import getRoutes from './database/getRoutes';

const CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
};

/**
 * Lambda handler for GET /routes (API Gateway proxy integration).
 * Returns all non-deleted routes as JSON matching the GetRoutesResponse schema.
 */
export const handler = async (
    _event: unknown,
    _context: unknown,
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
    let client: PoolClient | undefined;

    try {
        const pool = await getDatabaseConnection();
        client = await pool.connect();
        const rows = await getRoutes(client);

        const body = rows.map((row) => ({
            id: row.id,
            name: row.name,
            type: row.type,
            coordinates: row.coordinates as { lat: number; lon: number },
        }));

        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify(body),
        };
    } catch (error) {
        console.error('Error in getRoutes handler:', error);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                message: 'Internal server error',
                error: error instanceof Error ? error.message : String(error),
            }),
        };
    } finally {
        if (client) client.release();
    }
};
