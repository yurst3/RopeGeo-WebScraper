import getS3Object from '../../helpers/s3/getS3Object';

const ALLOWED_FILES = ['index.html', 'openapi.yaml', 'openapi.json'] as const;
const CONTENT_TYPES: Record<(typeof ALLOWED_FILES)[number], string> = {
    'index.html': 'text/html',
    'openapi.yaml': 'application/x-yaml',
    'openapi.json': 'application/json',
};

type ApiGatewayEvent = {
    pathParameters?: { file?: string } | null;
};

/**
 * Lambda handler for GET /docs/{file} (API Gateway HTTP API proxy integration).
 * Returns the requested documentation file from the docs S3 bucket.
 */
export const handler = async (
    event: ApiGatewayEvent,
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
    const file = event.pathParameters?.file;
    if (!file || !ALLOWED_FILES.includes(file as (typeof ALLOWED_FILES)[number])) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `Invalid file. Allowed: ${ALLOWED_FILES.join(', ')}`,
            }),
        };
    }

    const bucket = process.env.DOCS_BUCKET_NAME;
    if (!bucket) {
        console.error('DOCS_BUCKET_NAME is not set');
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Server configuration error' }),
        };
    }

    try {
        const { body, contentType: s3ContentType } = await getS3Object(bucket, file);
        const contentType = s3ContentType ?? CONTENT_TYPES[file as (typeof ALLOWED_FILES)[number]];

        return {
            statusCode: 200,
            headers: {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
            },
            body,
        };
    } catch (err: unknown) {
        const code = err && typeof err === 'object' && 'name' in err && err.name === 'NoSuchKey' ? 404 : 500;
        const message = code === 404 ? 'File not found' : 'Internal server error';
        console.error('getApiDocs error:', err);
        return {
            statusCode: code,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message }),
        };
    }
};
