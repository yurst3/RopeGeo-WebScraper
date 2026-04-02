import type { PoolClient } from 'pg';
import { RopewikiRegionViewResult } from 'ropegeo-common/classes';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import getRopewikiRegionView from './database/getRopewikiRegionView';

const CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
};

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lambda handler for GET /ropewiki/region/{id} (API Gateway proxy integration).
 * Returns a RopewikiRegionView for the given region id, or 400 if id is not a valid UUID, 404 if not found.
 */
export const handler = async (
    event: { pathParameters?: { id?: string } | null },
    _context: unknown,
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
    const id = event.pathParameters?.id?.trim();
    if (!id) {
        return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                message: 'Bad Request',
                error: 'Missing or empty path parameter: id',
            }),
        };
    }
    if (!UUID_REGEX.test(id)) {
        return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                message: 'Bad Request',
                error: 'Path parameter id must be a valid UUID',
            }),
        };
    }

    let client: PoolClient | undefined;

    try {
        const pool = await getDatabaseConnection();
        client = await pool.connect();

        const view = await getRopewikiRegionView(client, id);
        if (!view) {
            return {
                statusCode: 404,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    message: 'Not Found',
                    error: 'No Ropewiki region found with the given id',
                }),
            };
        }

        const result = new RopewikiRegionViewResult(view);
        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify(result),
        };
    } catch (error) {
        console.error('Error in getRopewikiRegionView handler:', error);
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
