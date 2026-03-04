import type { PoolClient } from 'pg';
import { SearchParams } from 'ropegeo-common';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import searchRopewiki from './util/searchRopewiki';

const CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
};

/**
 * Lambda handler for GET /search (API Gateway proxy integration).
 * Query params: name (required), similarity (default 0.5), include-pages (default true),
 * include-regions (default true), region (optional region id for ancestry filter), order (similarity | quality),
 * limit (default 20), cursor (optional base64url-encoded cursor for pagination).
 */
export const handler = async (
    event: {
        queryStringParameters?: Record<string, string | undefined> | null;
    },
    _context: unknown,
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
    if (event.queryStringParameters == null) {
        return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                message: 'Bad Request',
                error: 'Missing query string parameters',
            }),
        };
    }

    let params: SearchParams;
    try {
        params = SearchParams.fromQueryStringParams(event.queryStringParameters);
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
        const searchResults = await searchRopewiki(client, params);
        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify(searchResults),
        };
    } catch (error) {
        console.error('Error in search handler:', error);
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
