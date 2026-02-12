import { describe, it, expect } from '@jest/globals';
import { handler } from '../../../src/api/getRootRedirect/handler';

describe('getRootRedirect handler', () => {
    it('returns 302 with Location /docs/index.html', async () => {
        const result = await handler();

        expect(result.statusCode).toBe(302);
        expect(result.headers).toEqual({
            Location: '/docs/index.html',
            'Content-Type': 'text/plain',
        });
        expect(result.body).toBe('');
    });
});
