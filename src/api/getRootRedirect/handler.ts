/**
 * Lambda handler for GET / (API Gateway HTTP API proxy integration).
 * Returns a 302 redirect to /docs/index.html.
 */
export const handler = async (): Promise<{
    statusCode: number;
    headers: Record<string, string>;
    body: string;
}> => {
    return {
        statusCode: 302,
        headers: {
            Location: '/docs/index.html',
            'Content-Type': 'text/plain',
        },
        body: '',
    };
};
