import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { headSourceSizeKb } from '../../../../src/fargate-tasks/migrateImageData/util/headSourceSizeKb';
import httpRequest from '../../../../src/helpers/httpRequest';

jest.mock('../../../../src/helpers/httpRequest', () => ({ __esModule: true, default: jest.fn() }));

describe('headSourceSizeKb', () => {
    beforeEach(() => {
        jest.mocked(httpRequest).mockReset();
    });

    it('returns sizeKB from Content-Length when httpRequest succeeds', async () => {
        jest.mocked(httpRequest).mockResolvedValueOnce({
            headers: new Headers({ 'Content-Length': '2048' }),
        } as Response);

        const result = await headSourceSizeKb('https://example.com/image.jpg');

        expect(result).toEqual({ sizeKB: 2 });
        expect(httpRequest).toHaveBeenCalledTimes(1);
        expect(httpRequest).toHaveBeenCalledWith(
            'https://example.com/image.jpg',
            5,
            undefined,
            { method: 'HEAD' },
            undefined,
        );
    });

    it('rounds sizeKB to two decimal places', async () => {
        jest.mocked(httpRequest).mockResolvedValueOnce({
            headers: new Headers({ 'Content-Length': '1536' }),
        } as Response);

        const result = await headSourceSizeKb('https://example.com/img');

        expect(result).toEqual({ sizeKB: 1.5 });
    });

    it('returns null when Content-Length header is missing', async () => {
        jest.mocked(httpRequest).mockResolvedValueOnce({
            headers: new Headers({}),
        } as Response);

        const result = await headSourceSizeKb('https://example.com/img');

        expect(result).toBeNull();
    });

    it('returns null when httpRequest throws', async () => {
        jest.mocked(httpRequest).mockRejectedValueOnce(new Error('httpRequest non-OK: status=404'));

        const result = await headSourceSizeKb('https://example.com/missing');

        expect(result).toBeNull();
    });

    it('returns null when Content-Length is invalid', async () => {
        jest.mocked(httpRequest).mockResolvedValueOnce({
            headers: new Headers({ 'Content-Length': 'not-a-number' }),
        } as Response);

        const result = await headSourceSizeKb('https://example.com/img');

        expect(result).toBeNull();
    });

    it('passes useProxy through to httpRequest when provided', async () => {
        jest.mocked(httpRequest).mockResolvedValueOnce({
            headers: new Headers({ 'Content-Length': '1024' }),
        } as Response);

        await headSourceSizeKb('https://example.com/img', true);

        expect(httpRequest).toHaveBeenCalledWith(
            'https://example.com/img',
            5,
            undefined,
            { method: 'HEAD' },
            true,
        );
    });
});
