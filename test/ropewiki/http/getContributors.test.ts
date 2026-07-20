import { describe, it, expect, afterEach, jest } from '@jest/globals';
import getContributors from '../../../src/ropewiki/http/getContributors';
import { httpRequest } from 'ropegeo-common/helpers';

jest.mock('ropegeo-common/helpers', () => ({
    __esModule: true,
    httpRequest: jest.fn(),
}));

const mockHttpRequest = jest.mocked(httpRequest);

describe('getContributors', () => {
    afterEach(() => {
        mockHttpRequest.mockClear();
    });

    it('returns empty object for empty titles', async () => {
        await expect(getContributors([])).resolves.toEqual({});
        expect(mockHttpRequest).not.toHaveBeenCalled();
    });

    it('omits missing pages (pageid -1) and returns contributors for found titles', async () => {
        mockHttpRequest.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                batchcomplete: '',
                query: {
                    normalized: [
                        { from: 'File:Alger_Creek.kml', to: 'File:Alger Creek.kml' },
                        { from: 'File:The_Subway.kml', to: 'File:The Subway.kml' },
                    ],
                    pages: {
                        '-1': {
                            ns: 6,
                            title: 'File:Alger Creek.kml',
                            missing: '',
                        },
                        '1356': {
                            pageid: 1356,
                            ns: 6,
                            title: 'File:The Subway.kml',
                            contributors: [
                                { userid: 2, name: 'Bjp' },
                                { userid: 513, name: 'Lucach' },
                            ],
                        },
                    },
                },
            }),
        } as Response);

        const result = await getContributors([
            'File:Alger_Creek.kml',
            'File:The_Subway.kml',
        ]);

        expect(result).toEqual({
            'File:The Subway.kml': ['Bjp', 'Lucach'],
        });
        expect(result['File:Alger Creek.kml']).toBeUndefined();
    });

    it('merges contributors across continue tokens', async () => {
        mockHttpRequest
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    continue: { pccontinue: 'abc', continue: '-||' },
                    query: {
                        pages: {
                            '10': {
                                pageid: 10,
                                title: 'Birks',
                                contributors: [{ name: 'Coops' }],
                            },
                        },
                    },
                }),
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    batchcomplete: '',
                    query: {
                        pages: {
                            '10': {
                                pageid: 10,
                                title: 'Birks',
                                contributors: [{ name: 'Ryancomet' }],
                            },
                        },
                    },
                }),
            } as Response);

        const result = await getContributors(['Birks']);
        expect(result).toEqual({ Birks: ['Coops', 'Ryancomet'] });
        expect(mockHttpRequest).toHaveBeenCalledTimes(2);
    });
});
