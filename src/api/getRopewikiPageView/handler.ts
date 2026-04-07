import type { PoolClient } from 'pg';
import { RopewikiPageViewResult } from 'ropegeo-common/models';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import getRopewikiPageView from './database/getRopewikiPageView';

const CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
};

/**
 * Lambda handler for GET /ropewiki/page/{id} (API Gateway proxy integration).
 * Returns a RopewikiPageView for the given RopewikiPage id, or 404 if not found.
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

    let client: PoolClient | undefined;

    try {
        const pool = await getDatabaseConnection();
        client = await pool.connect();

        const view = await getRopewikiPageView(client, id);
        if (!view) {
            return {
                statusCode: 404,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    message: 'Not Found',
                    error: 'No Ropewiki page found with the given id',
                }),
            };
        }

        const result = new RopewikiPageViewResult(view);
        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify(result),
        };
    } catch (error) {
        console.error('Error in getRopewikiPageView handler:', error);
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
