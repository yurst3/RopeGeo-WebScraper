import { describe, it, expect, afterEach, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import getLengthAndElevGains from '../../../src/ropewiki/http/getLengthAndElevGains';
import httpRequest from '../../../src/helpers/httpRequest';

jest.mock('../../../src/helpers/httpRequest', () => ({
    __esModule: true,
    default: jest.fn(),
}));

const mockHttpRequest = jest.mocked(httpRequest);

const behuninFixturePath = path.join(
    __dirname,
    '..',
    'data',
    'behuninCanyon',
    'behuninCanyonWikitextResponse.json',
);
const hogwartsFixturePath = path.join(
    __dirname,
    '..',
    'data',
    'hogwartsCanyon',
    'hogwartsCanyonWikitextResponse.json',
);
const birksFixturePath = path.join(__dirname, '..', 'data', 'birks', 'birksWikitextResponse.json');
const behuninFixture = JSON.parse(fs.readFileSync(behuninFixturePath, 'utf-8'));
const hogwartsFixture = JSON.parse(fs.readFileSync(hogwartsFixturePath, 'utf-8'));
const birksFixture = JSON.parse(fs.readFileSync(birksFixturePath, 'utf-8'));

function getUrlStr(): string {
    const urlArg = mockHttpRequest.mock.calls[0]![0];
    return typeof urlArg === 'string' ? urlArg : (urlArg as URL).toString();
}

describe('getLengthAndElevGains', () => {
    afterEach(() => {
        mockHttpRequest.mockClear();
    });

    it('returns empty object when pageids is empty', async () => {
        const result = await getLengthAndElevGains([]);
        expect(result).toEqual({});
        expect(mockHttpRequest).not.toHaveBeenCalled();
    });

    it('parses Behunin Canyon from fixture (rvslots format)', async () => {
        mockHttpRequest.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => behuninFixture,
        } as Response);

        const result = await getLengthAndElevGains(['336']);

        expect(mockHttpRequest).toHaveBeenCalledTimes(1);
        expect(getUrlStr()).toContain('action=query');
        expect(getUrlStr()).toContain('pageids=336');
        expect(getUrlStr()).toContain('rvprop=content');
        expect(getUrlStr()).toContain('rvslots=');

        expect(Object.keys(result)).toHaveLength(1);
        expect(result['336']).toEqual({
            overallLength: 6.8,
            approachLength: 4,
            approachElevGain: 2700,
            descentLength: 1.8,
            descentElevGain: -1800,
            exitLength: 0.9,
            exitElevGain: -600,
        });
    });

    it('parses Hogwarts Canyon from fixture (rvslots format)', async () => {
        mockHttpRequest.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => hogwartsFixture,
        } as Response);

        const result = await getLengthAndElevGains(['527']);

        expect(mockHttpRequest).toHaveBeenCalledTimes(1);
        expect(getUrlStr()).toContain('rvslots=');

        expect(Object.keys(result)).toHaveLength(1);
        // Hogwarts has Approach length=0.6 mi, Approach elevation gain=550 ft, Length=0.2 mi,
        // Depth=-330, Exit length=0.4 mi, Exit elevation gain=100; no Hike length
        expect(result['527']).toEqual({
            overallLength: null,
            approachLength: 0.6,
            approachElevGain: 550,
            descentLength: 0.2,
            descentElevGain: -330,
            exitLength: 0.4,
            exitElevGain: 100,
        });
    });

    it('joins multiple pageids with pipe and parses each page using fixtures', async () => {
        const combined = {
            query: {
                pages: {
                    ...behuninFixture.query.pages,
                    ...hogwartsFixture.query.pages,
                },
            },
        };
        mockHttpRequest.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => combined,
        } as Response);

        const result = await getLengthAndElevGains(['336', '527']);

        expect(getUrlStr()).toContain('pageids=336%7C527');
        expect(result['336']?.overallLength).toBe(6.8);
        expect(result['336']?.approachLength).toBe(4);
        expect(result['527']?.overallLength).toBeNull();
        expect(result['527']?.approachLength).toBe(0.6);
        expect(result['527']?.exitElevGain).toBe(100);
    });

    it('omits missing or invalid pages from result', async () => {
        mockHttpRequest.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                query: {
                    pages: {
                        '336': behuninFixture.query.pages['336'],
                        '999': { missing: true },
                        '998': { invalid: true },
                    },
                },
            }),
        } as Response);

        const result = await getLengthAndElevGains(['336', '999', '998']);

        expect(Object.keys(result)).toEqual(['336']);
        expect(result['336']?.overallLength).toBe(6.8);
    });

    it('returns null for unparseable values', async () => {
        mockHttpRequest.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                query: {
                    pages: {
                        '1': {
                            pageid: 1,
                            revisions: [
                                {
                                    slots: {
                                        main: {
                                            '*':
                                                '{{Canyon\n|Hike length=not-a-number\n|Approach length=12miles\n}}\n',
                                        },
                                    },
                                },
                            ],
                        },
                    },
                },
            }),
        } as Response);

        const result = await getLengthAndElevGains(['1']);

        expect(result['1']?.overallLength).toBeNull();
        expect(result['1']?.approachLength).toBe(12);
    });

    it('throws when httpRequest fails', async () => {
        mockHttpRequest.mockRejectedValue(new Error('Network error'));

        await expect(getLengthAndElevGains(['336'])).rejects.toThrow('Network error');
    });

    it('converts metric units to miles and feet (Birks fixture)', async () => {
        mockHttpRequest.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => birksFixture,
        } as Response);

        const result = await getLengthAndElevGains(['34206']);

        expect(Object.keys(result)).toHaveLength(1);
        // Birks: Approach length=1720m, Approach elevation gain=200m, Length=1000m, Exit length=830m, Exit elevation gain=0m
        expect(result['34206']?.overallLength).toBeNull();
        expect(result['34206']?.approachLength).toBeCloseTo(1.069, 2); // 1720m -> mi
        expect(result['34206']?.approachElevGain).toBeCloseTo(656.168, 2); // 200m -> ft
        expect(result['34206']?.descentLength).toBeCloseTo(0.621, 2); // 1000m -> mi
        expect(result['34206']?.descentElevGain).toBeNull(); // Birks has no Depth=
        expect(result['34206']?.exitLength).toBeCloseTo(0.516, 2); // 830m -> mi
        expect(result['34206']?.exitElevGain).toBe(0); // 0m -> 0 ft
    });
});
