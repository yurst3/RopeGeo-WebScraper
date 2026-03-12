import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { headSourceSizeKb } from '../../../../src/fargate-tasks/migrateImageData/util/headSourceSizeKb';

describe('headSourceSizeKb', () => {
    const mockFetch = jest.fn();
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
        jest.useFakeTimers();
        originalFetch = globalThis.fetch;
        (globalThis as unknown as { fetch: typeof jest.fn }).fetch = mockFetch;
    });

    afterEach(() => {
        (globalThis as unknown as { fetch: typeof originalFetch }).fetch = originalFetch;
        jest.useRealTimers();
        mockFetch.mockReset();
    });

    it('returns sizeKB from Content-Length when response is ok', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            headers: new Headers({ 'Content-Length': '2048' }),
        });

        const promise = headSourceSizeKb('https://example.com/image.jpg');
        await jest.runAllTimersAsync();
        const result = await promise;

        expect(result).toEqual({ sizeKB: 2 });
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith('https://example.com/image.jpg', { method: 'HEAD' });
    });

    it('rounds sizeKB to two decimal places', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            headers: new Headers({ 'Content-Length': '1536' }), // 1.5 KB
        });

        const promise = headSourceSizeKb('https://example.com/img');
        await jest.runAllTimersAsync();
        const result = await promise;

        expect(result).toEqual({ sizeKB: 1.5 });
    });

    it('returns null when Content-Length header is missing', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            headers: new Headers({}),
        });

        const promise = headSourceSizeKb('https://example.com/img');
        await jest.runAllTimersAsync();
        const result = await promise;

        expect(result).toBeNull();
    });

    it('returns null when response is not ok', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            headers: new Headers({}),
        });

        const promise = headSourceSizeKb('https://example.com/missing');
        await jest.runAllTimersAsync();
        const result = await promise;

        expect(result).toBeNull();
        expect(mockFetch).toHaveBeenCalledTimes(5);
    });

    it('retries on fetch failure and returns null after 5 attempts', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'));

        const promise = headSourceSizeKb('https://example.com/img');
        await jest.runAllTimersAsync();
        const result = await promise;

        expect(result).toBeNull();
        expect(mockFetch).toHaveBeenCalledTimes(5);
    });

    it('returns result on retry after initial failure', async () => {
        mockFetch
            .mockRejectedValueOnce(new Error('Network error'))
            .mockRejectedValueOnce(new Error('Network error'))
            .mockResolvedValueOnce({
                ok: true,
                headers: new Headers({ 'Content-Length': '1024' }),
            });

        const promise = headSourceSizeKb('https://example.com/img');
        await jest.runAllTimersAsync();
        const result = await promise;

        expect(result).toEqual({ sizeKB: 1 });
        expect(mockFetch).toHaveBeenCalledTimes(3);
    });
});
