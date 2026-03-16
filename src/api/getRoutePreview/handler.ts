import type { PoolClient } from 'pg';
import { RoutePreviewResult } from 'ropegeo-common';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import getPageRoutes from './database/getPageRoutes';
import routeExists from './database/routeExists';
import getPagePreviews from './util/getPagePreviews';

const CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
};

/**
 * Lambda handler for GET /route/{routeId}/preview (API Gateway proxy integration).
 * Returns an array of PagePreview for pages linked to the route (e.g. Ropewiki pages).
 */
export const handler = async (
    event: { pathParameters?: { routeId?: string } | null },
    _context: unknown,
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
    const routeId = event.pathParameters?.routeId?.trim();
    if (!routeId) {
        return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                message: 'Bad Request',
                error: 'Missing or empty path parameter: routeId',
            }),
        };
    }

    let client: PoolClient | undefined;

    try {
        const pool = await getDatabaseConnection();
        client = await pool.connect();

        const exists = await routeExists(client, routeId);
        if (!exists) {
            return {
                statusCode: 404,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    message: 'Not Found',
                    error: 'No route found with the given routeId',
                }),
            };
        }

        const pageRoutes = await getPageRoutes(client, routeId);
        const previews = await getPagePreviews(client, pageRoutes);
        const result = new RoutePreviewResult(previews);
        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify(result),
        };
    } catch (error) {
        console.error('Error in getRoutePreview handler:', error);
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
