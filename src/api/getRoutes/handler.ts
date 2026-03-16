import type { PoolClient } from 'pg';
import { RoutesGeojson, RoutesGeojsonResult, RoutesParams } from 'ropegeo-common';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import getRoutes from './util/getRoutes';

const CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
};

/**
 * Lambda handler for GET /routes (API Gateway proxy integration).
 * Returns routes as a GeoJSON Feature Collection. Optional query params source and region
 * (validated via RoutesParams.fromQueryStringParams) restrict to that source/region and its descendants.
 */
export const handler = async (
    event: {
        queryStringParameters?: Record<string, string | undefined> | null;
    },
    _context: unknown,
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
    const rawParams = event.queryStringParameters ?? {};
    let params: RoutesParams;
    try {
        params = RoutesParams.fromQueryStringParams(rawParams);
    } catch (err) {
        return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                message: 'Bad Request',
                error: err instanceof Error ? err.message : String(err),
            }),
        };
    }

    let client: PoolClient | undefined;

    try {
        const pool = await getDatabaseConnection();
        client = await pool.connect();
        const routes = await getRoutes(client, params);
        const geojson = RoutesGeojson.fromRoutes(routes);
        const result = new RoutesGeojsonResult(geojson);
        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify(result),
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
