import type { PoolClient } from 'pg';
import { SearchParams } from 'ropegeo-common';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import searchRopewiki from './util/searchRopewiki';

const CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
};

/**
 * Build a single query-params record from the Lambda event so we support both REST API
 * (queryStringParameters) and HTTP API / Lambda URL (rawQueryString) and avoid missing
 * params when one or the other is absent.
 */
function getQueryParams(event: {
    queryStringParameters?: Record<string, string | undefined> | null;
    rawQueryString?: string;
}): Record<string, string | undefined> {
    const fromEvent = event.queryStringParameters ?? null;
    if (fromEvent != null && Object.keys(fromEvent).length > 0) {
        return fromEvent;
    }
    const raw = event.rawQueryString?.trim();
    if (!raw) return {};

    const parsed: Record<string, string | undefined> = {};
    for (const part of raw.split('&')) {
        const eq = part.indexOf('=');
        if (eq === -1) {
            parsed[decodeURIComponent(part.replace(/\+/g, ' '))] = undefined;
        } else {
            const key = decodeURIComponent(part.slice(0, eq).replace(/\+/g, ' '));
            const value = decodeURIComponent(part.slice(eq + 1).replace(/\+/g, ' '));
            parsed[key] = value;
        }
    }
    return parsed;
}

/**
 * Lambda handler for GET /search (API Gateway proxy integration).
 * Query params: name (required), similarity (default 0.5), include-pages (default true),
 * include-regions (default true), region (optional region id for ancestry filter), order (similarity | quality),
 * limit (default 20), cursor (optional base64url-encoded cursor for pagination).
 */
export const handler = async (
    event: {
        queryStringParameters?: Record<string, string | undefined> | null;
        rawQueryString?: string;
    },
    _context: unknown,
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
    let params: SearchParams;
    console.log('event', JSON.stringify(event, null, 4));
    try {
        params = SearchParams.fromQueryStringParams(getQueryParams(event));
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
