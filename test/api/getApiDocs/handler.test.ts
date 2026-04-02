import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { handler } from '../../../src/api/getApiDocs/handler';

let mockGetS3Object: jest.MockedFunction<typeof import('ropegeo-common/helpers').getS3Object>;
let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

jest.mock('ropegeo-common/helpers', () => ({
    __esModule: true,
    getS3Object: jest.fn(),
}));

describe('getApiDocs handler', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        process.env = { ...originalEnv, DOCS_BUCKET_NAME: 'my-docs-bucket' };

        mockGetS3Object = require('ropegeo-common/helpers').getS3Object;
        mockGetS3Object.mockResolvedValue({ body: '<html>docs</html>', contentType: 'text/html' });
    });

    afterEach(() => {
        process.env = originalEnv;
        consoleErrorSpy.mockRestore();
    });

    it('returns 400 when pathParameters is missing', async () => {
        const result = await handler({});

        expect(mockGetS3Object).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(400);
        expect(result.headers['Content-Type']).toBe('application/json');
        expect(JSON.parse(result.body)).toEqual({
            message: 'Invalid file. Allowed: index.html, openapi.yaml, openapi.json',
        });
    });

    it('returns 400 when file is missing', async () => {
        const result = await handler({ pathParameters: {} });

        expect(mockGetS3Object).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).message).toContain('Invalid file');
    });

    it('returns 400 when file is not allowed', async () => {
        const result = await handler({ pathParameters: { file: 'other.txt' } });

        expect(mockGetS3Object).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).message).toContain('Invalid file');
    });

    it('returns 500 when DOCS_BUCKET_NAME is not set', async () => {
        delete process.env.DOCS_BUCKET_NAME;

        const result = await handler({ pathParameters: { file: 'index.html' } });

        expect(mockGetS3Object).not.toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith('DOCS_BUCKET_NAME is not set');
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({ message: 'Server configuration error' });
    });

    it('returns 200 with body and Content-Type for index.html', async () => {
        const html = '<!DOCTYPE html><html><body>Redoc</body></html>';
        mockGetS3Object.mockResolvedValue({ body: html, contentType: 'text/html' });

        const result = await handler({ pathParameters: { file: 'index.html' } });

        expect(mockGetS3Object).toHaveBeenCalledWith('my-docs-bucket', 'index.html');
        expect(result.statusCode).toBe(200);
        expect(result.headers['Content-Type']).toBe('text/html');
        expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
        expect(result.body).toBe(html);
    });

    it('returns 200 with fallback Content-Type when S3 omits contentType', async () => {
        mockGetS3Object.mockResolvedValue({ body: 'openapi: 3.0' });

        const result = await handler({ pathParameters: { file: 'openapi.yaml' } });

        expect(result.statusCode).toBe(200);
        expect(result.headers['Content-Type']).toBe('application/x-yaml');
        expect(result.body).toBe('openapi: 3.0');
    });

    it('returns 200 for openapi.json with application/json', async () => {
        const json = '{"openapi":"3.0.1"}';
        mockGetS3Object.mockResolvedValue({ body: json, contentType: 'application/json' });

        const result = await handler({ pathParameters: { file: 'openapi.json' } });

        expect(mockGetS3Object).toHaveBeenCalledWith('my-docs-bucket', 'openapi.json');
        expect(result.statusCode).toBe(200);
        expect(result.headers['Content-Type']).toBe('application/json');
        expect(result.body).toBe(json);
    });

    it('returns 404 when getS3Object throws NoSuchKey', async () => {
        const err = new Error('The specified key does not exist.');
        (err as Error & { name: string }).name = 'NoSuchKey';
        mockGetS3Object.mockRejectedValue(err);

        const result = await handler({ pathParameters: { file: 'index.html' } });

        expect(consoleErrorSpy).toHaveBeenCalledWith('getApiDocs error:', err);
        expect(result.statusCode).toBe(404);
        expect(result.headers['Content-Type']).toBe('application/json');
        expect(JSON.parse(result.body)).toEqual({ message: 'File not found' });
    });

    it('returns 500 when getS3Object throws other error', async () => {
        const err = new Error('AccessDenied');
        mockGetS3Object.mockRejectedValue(err);

        const result = await handler({ pathParameters: { file: 'index.html' } });

        expect(consoleErrorSpy).toHaveBeenCalledWith('getApiDocs error:', err);
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({ message: 'Internal server error' });
    });

    it('returns 400 when pathParameters is null', async () => {
        const result = await handler({ pathParameters: null } as never);

        expect(mockGetS3Object).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(400);
    });
});
