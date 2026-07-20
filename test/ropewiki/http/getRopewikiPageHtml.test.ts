import { describe, it, expect, afterEach, jest } from '@jest/globals';
import getRopewikiPageHtml from '../../../src/ropewiki/http/getRopewikiPageHtml';
import { httpRequest } from 'ropegeo-common/helpers';

jest.mock('ropegeo-common/helpers', () => ({
    __esModule: true,
    httpRequest: jest.fn(),
}));

const mockHttpRequest = jest.mocked(httpRequest);

describe('getRopewikiPageHtml', () => {
    afterEach(() => {
        mockHttpRequest.mockClear();
    });

    it('returns HTML from parse.text', async () => {
        mockHttpRequest.mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({
                parse: {
                    text: { '*': '<div>html</div>' },
                },
            }),
        } as Response);

        const html = await getRopewikiPageHtml('5597');

        expect(html).toBe('<div>html</div>');
        expect(mockHttpRequest).toHaveBeenCalledTimes(1);
    });

    it('throws when fetch fails', async () => {
        mockHttpRequest.mockRejectedValue(new Error('network failure'));

        const err = await getRopewikiPageHtml('5597').catch((e) => e);
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toContain('Error getting ropewiki page html');
        expect((err as Error).message).toContain('network failure');
    });
});
