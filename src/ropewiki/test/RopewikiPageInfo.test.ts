import { describe, it, expect, jest } from '@jest/globals';
import RopewikiPageInfo from '../types/ropewiki';

describe('RopewikiPageInfo', () => {
    const validLatestRevisionDate = [{ timestamp: '1609459200', raw: '1/2021/1/1/0/0/0/0' }]; // 2021-01-01 00:00:00 UTC
    const testRegionId = '00000000-0000-0000-0000-000000000001';
    const regionNameIds: {[name: string]: string} = { 'Test Region': testRegionId };

    it('sets isValid to false when required fields are missing', () => {
        const invalidRawData = {
            printouts: {
                pageid: [], // Missing required field
                name: ['Invalid Page'],
                region: [],
                url: [],
                latestRevisionDate: validLatestRevisionDate,
            },
        };

        const pageInfo = new RopewikiPageInfo(invalidRawData, regionNameIds);

        expect(pageInfo.isValid).toBe(false);
        expect(pageInfo.pageid).toBe('');
        expect(pageInfo.name).toBe('Invalid Page');
        expect(pageInfo.region).toBe('00000000-0000-0000-0000-000000000000'); // Default UUID when region is missing
        expect(pageInfo.url).toBe('');
    });

    it('sets isValid to false when name is missing', () => {
        const invalidRawData = {
            printouts: {
                pageid: ['12345'],
                name: [], // Missing required field
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/test'],
                latestRevisionDate: validLatestRevisionDate,
            },
        };

        const pageInfo = new RopewikiPageInfo(invalidRawData, regionNameIds);

        expect(pageInfo.isValid).toBe(false);
        expect(pageInfo.pageid).toBe('12345');
        expect(pageInfo.name).toBe('');
    });

    it('sets isValid to false when region is missing', () => {
        const invalidRawData = {
            printouts: {
                pageid: ['12345'],
                name: ['Test Page'],
                region: [], // Missing required field
                url: ['https://ropewiki.com/test'],
                latestRevisionDate: validLatestRevisionDate,
            },
        };

        const pageInfo = new RopewikiPageInfo(invalidRawData, regionNameIds);

        expect(pageInfo.isValid).toBe(false);
        expect(pageInfo.region).toBe('00000000-0000-0000-0000-000000000000'); // Default UUID when region is missing
    });

    it('sets isValid to false when url is missing', () => {
        const invalidRawData = {
            printouts: {
                pageid: ['12345'],
                name: ['Test Page'],
                region: [{ fulltext: 'Test Region' }],
                url: [], // Missing required field
                latestRevisionDate: validLatestRevisionDate,
            },
        };

        const pageInfo = new RopewikiPageInfo(invalidRawData, regionNameIds);

        expect(pageInfo.isValid).toBe(false);
        expect(pageInfo.url).toBe('');
    });

    it('sets isValid to false when latestRevisionDate is missing', () => {
        const invalidRawData = {
            printouts: {
                pageid: ['12345'],
                name: ['Test Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/test'],
                latestRevisionDate: [], // Missing required field
            },
        };

        const pageInfo = new RopewikiPageInfo(invalidRawData, regionNameIds);

        expect(pageInfo.isValid).toBe(false);
        expect(pageInfo.latestRevisionDate).toBeInstanceOf(Date);
        expect(pageInfo.latestRevisionDate.getTime()).toBe(0); // Defaults to epoch when not found
    });

    it('sets isValid to true when all required fields are present', () => {
        const validRawData = {
            printouts: {
                pageid: ['12345'],
                name: ['Test Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/test'],
                latestRevisionDate: validLatestRevisionDate,
            },
        };

        const pageInfo = new RopewikiPageInfo(validRawData, regionNameIds);

        expect(pageInfo.isValid).toBe(true);
        expect(pageInfo.pageid).toBe('12345');
        expect(pageInfo.name).toBe('Test Page');
        expect(pageInfo.region).toBe(testRegionId); // Region is now the ID, not the name
        expect(pageInfo.url).toBe('https://ropewiki.com/test');
        expect(pageInfo.latestRevisionDate).toBeInstanceOf(Date);
        expect(pageInfo.latestRevisionDate.getTime()).toBe(1609459200000);
    });

    it('parses rappelInfo correctly', () => {
        const rawData = {
            printouts: {
                pageid: ['12345'],
                name: ['Test Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/test'],
                latestRevisionDate: validLatestRevisionDate,
                rappelInfo: ['2r'],
            },
        };

        const pageInfo = new RopewikiPageInfo(rawData, regionNameIds);

        expect(pageInfo.rappelInfo).toBe('2r');
    });

    it('parses rappelCount as number', () => {
        const rawData = {
            printouts: {
                pageid: ['12345'],
                name: ['Test Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/test'],
                latestRevisionDate: validLatestRevisionDate,
                rappelCount: [2],
            },
        };

        const pageInfo = new RopewikiPageInfo(rawData, regionNameIds);

        expect(pageInfo.rappelCount).toBe(2);
        expect(typeof pageInfo.rappelCount).toBe('number');
    });

    it('parses rappelCount as 0 when value is 0', () => {
        const rawData = {
            printouts: {
                pageid: ['12345'],
                name: ['Test Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/test'],
                latestRevisionDate: validLatestRevisionDate,
                rappelCount: [0],
            },
        };

        const pageInfo = new RopewikiPageInfo(rawData, regionNameIds);

        expect(pageInfo.rappelCount).toBe(0);
    });

    it('parses aka as semicolon-separated array', () => {
        const rawData = {
            printouts: {
                pageid: ['12345'],
                name: ['Test Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/test'],
                latestRevisionDate: validLatestRevisionDate,
                aka: ['First AKA; Second AKA; Third AKA'],
            },
        };

        const pageInfo = new RopewikiPageInfo(rawData, regionNameIds);

        expect(pageInfo.aka).toEqual(['First AKA', 'Second AKA', 'Third AKA']);
    });

    it('parses aka as empty array when empty', () => {
        const rawData = {
            printouts: {
                pageid: ['12345'],
                name: ['Test Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/test'],
                latestRevisionDate: validLatestRevisionDate,
                aka: [],
            },
        };

        const pageInfo = new RopewikiPageInfo(rawData, regionNameIds);

        expect(pageInfo.aka).toEqual([]);
    });

    it('parses betaSites as comma-separated array', () => {
        const rawData = {
            printouts: {
                pageid: ['12345'],
                name: ['Test Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/test'],
                latestRevisionDate: validLatestRevisionDate,
                betaSites: ['http://site1.com, http://site2.com, http://site3.com'],
            },
        };

        const pageInfo = new RopewikiPageInfo(rawData, regionNameIds);

        expect(pageInfo.betaSites).toEqual(['http://site1.com', 'http://site2.com', 'http://site3.com']);
    });

    it('parses betaSites as empty array when empty', () => {
        const rawData = {
            printouts: {
                pageid: ['12345'],
                name: ['Test Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/test'],
                latestRevisionDate: validLatestRevisionDate,
                betaSites: [],
            },
        };

        const pageInfo = new RopewikiPageInfo(rawData, regionNameIds);

        expect(pageInfo.betaSites).toEqual([]);
    });

    it('parses userVotes correctly', () => {
        const rawData = {
            printouts: {
                pageid: ['12345'],
                name: ['Test Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/test'],
                latestRevisionDate: validLatestRevisionDate,
                userVotes: [5],
            },
        };

        const pageInfo = new RopewikiPageInfo(rawData, regionNameIds);

        expect(pageInfo.userVotes).toBe(5);
        expect(typeof pageInfo.userVotes).toBe('number');
    });

    it('parses latestRevisionDate from Unix timestamp', () => {
        const rawData = {
            printouts: {
                pageid: ['12345'],
                name: ['Test Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/test'],
                latestRevisionDate: [{ timestamp: '1609459200', raw: '1/2021/1/1/0/0/0/0' }],
            },
        };

        const pageInfo = new RopewikiPageInfo(rawData, regionNameIds);

        expect(pageInfo.latestRevisionDate).toBeInstanceOf(Date);
        expect(pageInfo.latestRevisionDate.getTime()).toBe(1609459200000); // Unix timestamp * 1000
    });

    it('trims whitespace from aka and betaSites', () => {
        const rawData = {
            printouts: {
                pageid: ['12345'],
                name: ['Test Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/test'],
                latestRevisionDate: validLatestRevisionDate,
                aka: [' First AKA ; Second AKA ; Third AKA '],
                betaSites: [' http://site1.com , http://site2.com , http://site3.com '],
            },
        };

        const pageInfo = new RopewikiPageInfo(rawData, regionNameIds);

        expect(pageInfo.aka).toEqual(['First AKA', 'Second AKA', 'Third AKA']);
        expect(pageInfo.betaSites).toEqual(['http://site1.com', 'http://site2.com', 'http://site3.com']);
    });

    it('filters empty strings from aka and betaSites', () => {
        const rawData = {
            printouts: {
                pageid: ['12345'],
                name: ['Test Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/test'],
                latestRevisionDate: validLatestRevisionDate,
                aka: ['First AKA;;Second AKA'],
                betaSites: ['http://site1.com,,http://site2.com'],
            },
        };

        const pageInfo = new RopewikiPageInfo(rawData, regionNameIds);

        expect(pageInfo.aka).toEqual(['First AKA', 'Second AKA']);
        expect(pageInfo.betaSites).toEqual(['http://site1.com', 'http://site2.com']);
    });

    it('sets isValid to false and uses default UUID when region name is not found in regionNameIds', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const emptyRegionNameIds: {[name: string]: string} = {};
        
        const rawData = {
            printouts: {
                pageid: ['12345'],
                name: ['Test Page'],
                region: [{ fulltext: 'Unknown Region' }],
                url: ['https://ropewiki.com/test'],
                latestRevisionDate: validLatestRevisionDate,
            },
        };

        const pageInfo = new RopewikiPageInfo(rawData, emptyRegionNameIds);

        expect(pageInfo.isValid).toBe(false);
        expect(pageInfo.region).toBe('00000000-0000-0000-0000-000000000000'); // Default UUID
        expect(consoleErrorSpy).toHaveBeenCalledWith('Page 12345 Test Page has region "Unknown Region" that we don\'t have an ID for');
        
        consoleErrorSpy.mockRestore();
    });
});

