import { describe, it, expect, afterEach, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import getRopewikiPageHtml from '../../../src/ropewiki/http/getRopewikiPageHtml';
import httpRequest from 'ropegeo-common/helpers/httpRequest';

jest.mock('ropegeo-common/helpers/httpRequest', () => ({
    __esModule: true,
    default: jest.fn(),
}));

const fixturePath = path.join(__dirname, '..', 'data', 'regions', 'ropewikiRegionsResponse.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

const mockHttpRequest = jest.mocked(httpRequest);

describe('getRopewikiPageHtml', () => {
    afterEach(() => {
        mockHttpRequest.mockClear();
    });

    it('returns HTML when fetch succeeds', async () => {
        const regionPageId = '5597';
        mockHttpRequest.mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => fixture,
        } as Response);

        const html = await getRopewikiPageHtml(regionPageId);

        expect(html).toBe(fixture.parse.text['*']);
        expect(mockHttpRequest).toHaveBeenCalledTimes(1);
    });

    it('throws when fetch returns an error status', async () => {
        const regionPageId = '5597';
        mockHttpRequest.mockRejectedValue(
            new Error('httpRequest non-OK: status=500 statusText=Internal Server Error')
        );

        const err = await getRopewikiPageHtml(regionPageId).catch((e) => e);
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toContain('Error getting regions html');
        expect((err as Error).message).toContain('500');
        expect(mockHttpRequest).toHaveBeenCalledTimes(1);
    });

    it('throws when fetch itself rejects', async () => {
        const regionPageId = '5597';
        mockHttpRequest.mockRejectedValue(new Error('network failure'));

        const err = await getRopewikiPageHtml(regionPageId).catch((e) => e);
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toContain('Error getting regions html');
        expect((err as Error).message).toContain('network failure');
        expect(mockHttpRequest).toHaveBeenCalledTimes(1);
    });
});
