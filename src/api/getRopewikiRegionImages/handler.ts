import type { PoolClient } from 'pg';
import { RopewikiRegionImagesParams } from 'ropegeo-common/classes';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import getAllowedRegionIds from '../../ropewiki/database/getAllowedRegionIds';
import getRopewikiRegionImages from './util/getRopewikiRegionImages';

const CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
};

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lambda handler for GET /ropewiki/region/{id}/images (API Gateway proxy integration).
 * Returns paginated RopewikiRegionImageView (banner images) for pages in the region and its descendants, ordered by page popularity.
 * 400 if id invalid or query params invalid; 404 if region not found.
 */
export const handler = async (
    event: {
        pathParameters?: { id?: string } | null;
        queryStringParameters?: Record<string, string | undefined> | null;
    },
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

    let params: RopewikiRegionImagesParams;
    try {
        params = RopewikiRegionImagesParams.fromQueryStringParams(
            event.queryStringParameters ?? {},
        );
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                message: 'Bad Request',
                error: message,
            }),
        };
    }

    let client: PoolClient | undefined;

    try {
        const pool = await getDatabaseConnection();
        client = await pool.connect();

        const allowedRegionIds = await getAllowedRegionIds(client, id);
        if (allowedRegionIds.length === 0) {
            return {
                statusCode: 404,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    message: 'Not Found',
                    error: 'No Ropewiki region found with the given id',
                }),
            };
        }

        const result = await getRopewikiRegionImages(client, id, params);
        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify(result),
        };
    } catch (error) {
        console.error('Error in getRopewikiRegionImages handler:', error);
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
