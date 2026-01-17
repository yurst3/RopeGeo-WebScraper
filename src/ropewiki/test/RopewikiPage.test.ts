import { describe, it, expect, jest } from '@jest/globals';
import RopewikiPage from '../types/page';

describe('RopewikiPage', () => {
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

        const pageInfo = RopewikiPage.fromResponseBody(invalidRawData, regionNameIds);

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

        const pageInfo = RopewikiPage.fromResponseBody(invalidRawData, regionNameIds);

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

        const pageInfo = RopewikiPage.fromResponseBody(invalidRawData, regionNameIds);

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

        const pageInfo = RopewikiPage.fromResponseBody(invalidRawData, regionNameIds);

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

        const pageInfo = RopewikiPage.fromResponseBody(invalidRawData, regionNameIds);

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

        const pageInfo = RopewikiPage.fromResponseBody(validRawData, regionNameIds);

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

        const pageInfo = RopewikiPage.fromResponseBody(rawData, regionNameIds);

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

        const pageInfo = RopewikiPage.fromResponseBody(rawData, regionNameIds);

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

        const pageInfo = RopewikiPage.fromResponseBody(rawData, regionNameIds);

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

        const pageInfo = RopewikiPage.fromResponseBody(rawData, regionNameIds);

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

        const pageInfo = RopewikiPage.fromResponseBody(rawData, regionNameIds);

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

        const pageInfo = RopewikiPage.fromResponseBody(rawData, regionNameIds);

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

        const pageInfo = RopewikiPage.fromResponseBody(rawData, regionNameIds);

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

        const pageInfo = RopewikiPage.fromResponseBody(rawData, regionNameIds);

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

        const pageInfo = RopewikiPage.fromResponseBody(rawData, regionNameIds);

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

        const pageInfo = RopewikiPage.fromResponseBody(rawData, regionNameIds);

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

        const pageInfo = RopewikiPage.fromResponseBody(rawData, regionNameIds);

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

        const pageInfo = RopewikiPage.fromResponseBody(rawData, emptyRegionNameIds);

        expect(pageInfo.isValid).toBe(false);
        expect(pageInfo.region).toBe('00000000-0000-0000-0000-000000000000'); // Default UUID
        expect(consoleErrorSpy).toHaveBeenCalledWith('Page 12345 Test Page has region "Unknown Region" that we don\'t have an ID for');
        
        consoleErrorSpy.mockRestore();
    });

    describe('toDbRow', () => {
        it('converts RopewikiPage to database row format', () => {
            const mockDate = new Date('2023-01-15T10:30:00.000Z');
            jest.useFakeTimers();
            jest.setSystemTime(mockDate);

            const rawData = {
                printouts: {
                    pageid: ['12345'],
                    name: ['Test Page'],
                    region: [{ fulltext: 'Test Region' }],
                    url: ['https://ropewiki.com/test'],
                    latestRevisionDate: validLatestRevisionDate,
                    rating: ['5.10a'],
                    timeRating: ['III'],
                    kmlUrl: ['https://ropewiki.com/test.kml'],
                    technicalRating: ['C2'],
                    waterRating: ['IV'],
                    riskRating: ['Moderate'],
                    permits: ['Required'],
                    rappelInfo: ['2 rappels'],
                    rappelCount: [2],
                    vehicle: ['4WD'],
                    quality: [3.5],
                    coordinates: [{ lat: 37.7749, lon: -122.4194 }],
                    rappelLongest: [{ value: 30, unit: 'm' }],
                    shuttle: [{ value: 2, unit: 'km' }],
                    minTime: [{ value: 4, unit: 'hours' }],
                    maxTime: [{ value: 8, unit: 'hours' }],
                    hike: [{ value: 1, unit: 'km' }],
                    months: ['January', 'February', 'March'],
                    aka: ['Alternative Name'],
                    betaSites: ['http://beta.com'],
                    userVotes: [10],
                },
            };

            const pageInfo = RopewikiPage.fromResponseBody(rawData, regionNameIds);
            const dbRow = pageInfo.toDbRow();

            expect(dbRow.pageId).toBe('12345');
            expect(dbRow.name).toBe('Test Page');
            expect(dbRow.region).toBe(testRegionId);
            expect(dbRow.url).toBe('https://ropewiki.com/test');
            expect(dbRow.rating).toBe('5.10a');
            expect(dbRow.timeRating).toBe('III');
            expect(dbRow.kmlUrl).toBe('https://ropewiki.com/test.kml');
            expect(dbRow.technicalRating).toBe('C2');
            expect(dbRow.waterRating).toBe('IV');
            expect(dbRow.riskRating).toBe('Moderate');
            expect(dbRow.permits).toBe('Required');
            expect(dbRow.rappelInfo).toBe('2 rappels');
            expect(dbRow.rappelCount).toBe(2);
            expect(dbRow.vehicle).toBe('4WD');
            expect(dbRow.quality).toBe(3.5);
            expect(dbRow.coordinates).toBe(JSON.stringify({ lat: 37.7749, lon: -122.4194 }));
            expect(dbRow.rappelLongest).toBe(JSON.stringify({ value: 30, unit: 'm' }));
            expect(dbRow.shuttle).toBe(JSON.stringify({ value: 2, unit: 'km' }));
            expect(dbRow.minTime).toBe(JSON.stringify({ value: 4, unit: 'hours' }));
            expect(dbRow.maxTime).toBe(JSON.stringify({ value: 8, unit: 'hours' }));
            expect(dbRow.hike).toBe(JSON.stringify({ value: 1, unit: 'km' }));
            expect(dbRow.months).toBe(JSON.stringify(['January', 'February', 'March']));
            expect(dbRow.aka).toBe(JSON.stringify(['Alternative Name']));
            expect(dbRow.betaSites).toBe(JSON.stringify(['http://beta.com']));
            expect(dbRow.userVotes).toBe(10);
            expect(dbRow.latestRevisionDate).toEqual(new Date(1609459200000));
            expect(dbRow.updatedAt).toEqual(mockDate);
            expect(dbRow.deletedAt).toBeNull();

            jest.useRealTimers();
        });

        it('converts undefined fields to null in database row', () => {
            const mockDate = new Date('2023-01-15T10:30:00.000Z');
            jest.useFakeTimers();
            jest.setSystemTime(mockDate);

            const rawData = {
                printouts: {
                    pageid: ['12345'],
                    name: ['Test Page'],
                    region: [{ fulltext: 'Test Region' }],
                    url: ['https://ropewiki.com/test'],
                    latestRevisionDate: validLatestRevisionDate,
                },
            };

            const pageInfo = RopewikiPage.fromResponseBody(rawData, regionNameIds);
            const dbRow = pageInfo.toDbRow();

            expect(dbRow.rating).toBeNull();
            expect(dbRow.timeRating).toBeNull();
            expect(dbRow.kmlUrl).toBeNull();
            expect(dbRow.technicalRating).toBeNull();
            expect(dbRow.waterRating).toBeNull();
            expect(dbRow.riskRating).toBeNull();
            expect(dbRow.permits).toBeNull();
            expect(dbRow.rappelInfo).toBeNull();
            expect(dbRow.rappelCount).toBeNull();
            expect(dbRow.vehicle).toBeNull();
            expect(dbRow.quality).toBeNull();
            expect(dbRow.coordinates).toBeNull();
            expect(dbRow.rappelLongest).toBeNull();
            expect(dbRow.shuttle).toBeNull();
            expect(dbRow.minTime).toBeNull();
            expect(dbRow.maxTime).toBeNull();
            expect(dbRow.hike).toBeNull();
            expect(dbRow.months).toBeNull();
            expect(dbRow.aka).toBeNull();
            expect(dbRow.betaSites).toBeNull();
            expect(dbRow.userVotes).toBeNull();
            expect(dbRow.updatedAt).toEqual(mockDate);
            expect(dbRow.deletedAt).toBeNull();

            jest.useRealTimers();
        });

        it('converts empty arrays to null for aka and betaSites', () => {
            const mockDate = new Date('2023-01-15T10:30:00.000Z');
            jest.useFakeTimers();
            jest.setSystemTime(mockDate);

            const rawData = {
                printouts: {
                    pageid: ['12345'],
                    name: ['Test Page'],
                    region: [{ fulltext: 'Test Region' }],
                    url: ['https://ropewiki.com/test'],
                    latestRevisionDate: validLatestRevisionDate,
                    aka: [],
                    betaSites: [],
                },
            };

            const pageInfo = RopewikiPage.fromResponseBody(rawData, regionNameIds);
            const dbRow = pageInfo.toDbRow();

            expect(dbRow.aka).toBeNull();
            expect(dbRow.betaSites).toBeNull();

            jest.useRealTimers();
        });
    });
});

