import { MapDataTileKeysResults } from 'ropegeo-common/models';
import getTilesAndTotalBytes from './util/getTilesAndTotalBytes';

const CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 5000;

/** UUID v4 (RFC 4122) string */
const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parsePositiveInt(name: string, raw: string | undefined, defaultValue: number): number {
    if (raw === undefined || raw === '') return defaultValue;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) {
        throw new Error(`${name} must be a positive integer`);
    }
    return n;
}

/**
 * Lambda handler for GET /mapdata/{mapDataId}/tiles (page-based list of vector tile download URLs).
 */
export const handler = async (
    event: {
        pathParameters?: { mapDataId?: string } | null;
        queryStringParameters?: Record<string, string | undefined> | null;
    },
    _context: unknown,
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
    const mapDataId = event.pathParameters?.mapDataId?.trim();
    if (!mapDataId || !UUID_RE.test(mapDataId)) {
        return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                message: 'Bad Request',
                error: 'Missing or invalid path parameter: mapDataId (expected UUID)',
            }),
        };
    }

    let page: number;
    let limit: number;
    try {
        page = parsePositiveInt('page', event.queryStringParameters?.page, 1);
        limit = parsePositiveInt('limit', event.queryStringParameters?.limit, DEFAULT_LIMIT);
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

    if (limit > MAX_LIMIT) {
        return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                message: 'Bad Request',
                error: `limit must be at most ${MAX_LIMIT}`,
            }),
        };
    }

    try {
        const { results: allTileUrls, totalBytes } = await getTilesAndTotalBytes(mapDataId);
        const total = allTileUrls.length;
        const start = (page - 1) * limit;
        const pageResults = allTileUrls.slice(start, start + limit);

        const pagination = new MapDataTileKeysResults(pageResults, total, page, totalBytes);

        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify(pagination),
        };
    } catch (error) {
        console.error('Error in getMapdataTiles handler:', error);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                message: 'Internal server error',
                error: error instanceof Error ? error.message : String(error),
            }),
        };
    }
};
