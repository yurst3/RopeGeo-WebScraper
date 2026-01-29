import { describe, it, expect } from '@jest/globals';
import { RopewikiRegion } from '../../../src/ropewiki/types/region';

describe('RopewikiRegion.fromResponseBody', () => {
    it('parses a complete region response correctly', () => {
        const raw = {
            printouts: {
                latestRevisionDate: [
                    {
                        timestamp: '1709239731',
                        raw: '1/2024/2/29/20/48/51/0'
                    }
                ],
                parentRegion: [
                    {
                        fulltext: 'Zion National Park',
                        fullurl: 'https://ropewiki.com/Zion_National_Park',
                        namespace: 0,
                        exists: '1',
                        displaytitle: ''
                    }
                ],
                pageCount: [15],
                level: [7],
                overview: ['Zion West Side region description'],
                bestMonths: ['March', 'April', 'May'],
                isMajorRegion: ['t'],
                isTopLevelRegion: ['f']
            }
        };

        const region = RopewikiRegion.fromResponseBody('Zion West Side', raw);

        expect(region.name).toBe('Zion West Side');
        expect(region.parentRegion).toBe('Zion National Park');
        expect(region.pageCount).toBe(15);
        expect(region.level).toBe(7);
        expect(region.overview).toBe('Zion West Side region description');
        expect(region.bestMonths).toEqual(['March', 'April', 'May']);
        expect(region.isMajorRegion).toBe(true);
        expect(region.isTopLevelRegion).toBe(false);
        expect(region.latestRevisionDate).toEqual(new Date(1709239731 * 1000));
        expect(region.url).toBe('https://ropewiki.com/Zion_West_Side');
    });

    it('handles region with no parent (undefined parentRegion)', () => {
        const raw = {
            printouts: {
                latestRevisionDate: [
                    {
                        timestamp: '1709239731',
                        raw: '1/2024/2/29/20/48/51/0'
                    }
                ],
                parentRegion: [],
                pageCount: [100],
                level: [1],
                overview: ['World region'],
                bestMonths: [],
                isMajorRegion: ['t'],
                isTopLevelRegion: ['t']
            }
        };

        const region = RopewikiRegion.fromResponseBody('World', raw);

        expect(region.name).toBe('World');
        expect(region.parentRegion).toBeUndefined();
        expect(region.pageCount).toBe(100);
        expect(region.level).toBe(1);
        expect(region.overview).toBe('World region');
        expect(region.bestMonths).toEqual([]);
        expect(region.isMajorRegion).toBe(true);
        expect(region.isTopLevelRegion).toBe(true);
        expect(region.url).toBe('https://ropewiki.com/World');
    });

    it('handles empty arrays for optional fields', () => {
        const raw = {
            printouts: {
                latestRevisionDate: [
                    {
                        timestamp: '1709239731',
                        raw: '1/2024/2/29/20/48/51/0'
                    }
                ],
                parentRegion: [
                    {
                        fulltext: 'Southwest Utah',
                        fullurl: 'https://ropewiki.com/Southwest_Utah',
                        namespace: 0,
                        exists: '1',
                        displaytitle: ''
                    }
                ],
                pageCount: [86],
                level: [6],
                overview: [],
                bestMonths: [],
                isMajorRegion: [],
                isTopLevelRegion: []
            }
        };

        const region = RopewikiRegion.fromResponseBody('Zion National Park', raw);

        expect(region.name).toBe('Zion National Park');
        expect(region.parentRegion).toBe('Southwest Utah');
        expect(region.pageCount).toBe(86);
        expect(region.level).toBe(6);
        expect(region.overview).toBeUndefined();
        expect(region.bestMonths).toEqual([]);
        expect(region.isMajorRegion).toBe(false); // Empty array defaults to false
        expect(region.isTopLevelRegion).toBe(false); // Empty array defaults to false
    });

    it('handles missing latestRevisionDate (defaults to epoch)', () => {
        const raw = {
            printouts: {
                latestRevisionDate: [],
                parentRegion: [
                    {
                        fulltext: 'Parent Region',
                        fullurl: 'https://ropewiki.com/Parent_Region',
                        namespace: 0,
                        exists: '1',
                        displaytitle: ''
                    }
                ],
                pageCount: [10],
                level: [5],
                overview: [],
                bestMonths: [],
                isMajorRegion: ['f'],
                isTopLevelRegion: ['f']
            }
        };

        const region = RopewikiRegion.fromResponseBody('Test Region', raw);

        expect(region.latestRevisionDate).toEqual(new Date(0)); // Epoch
    });

    it('handles missing timestamp in latestRevisionDate', () => {
        const raw = {
            printouts: {
                latestRevisionDate: [
                    {
                        raw: '1/2024/2/29/20/48/51/0'
                        // missing timestamp
                    }
                ],
                parentRegion: [],
                pageCount: [5],
                level: [3],
                overview: [],
                bestMonths: [],
                isMajorRegion: ['f'],
                isTopLevelRegion: ['f']
            }
        };

        const region = RopewikiRegion.fromResponseBody('Test Region', raw);

        expect(region.latestRevisionDate).toEqual(new Date(0)); // Defaults to epoch when timestamp missing
    });

    it('handles missing pageCount and level (defaults to 0)', () => {
        const raw = {
            printouts: {
                latestRevisionDate: [
                    {
                        timestamp: '1709239731',
                        raw: '1/2024/2/29/20/48/51/0'
                    }
                ],
                parentRegion: [],
                pageCount: [],
                level: [],
                overview: [],
                bestMonths: [],
                isMajorRegion: ['f'],
                isTopLevelRegion: ['f']
            }
        };

        const region = RopewikiRegion.fromResponseBody('Test Region', raw);

        expect(region.pageCount).toBe(0);
        expect(region.level).toBe(0);
    });

    it('parses boolean fields correctly (t = true, f = false)', () => {
        const rawTrue = {
            printouts: {
                latestRevisionDate: [
                    {
                        timestamp: '1709239731',
                        raw: '1/2024/2/29/20/48/51/0'
                    }
                ],
                parentRegion: [],
                pageCount: [50],
                level: [2],
                overview: [],
                bestMonths: [],
                isMajorRegion: ['t'],
                isTopLevelRegion: ['t']
            }
        };

        const regionTrue = RopewikiRegion.fromResponseBody('Major Region', rawTrue);
        expect(regionTrue.isMajorRegion).toBe(true);
        expect(regionTrue.isTopLevelRegion).toBe(true);

        const rawFalse = {
            printouts: {
                latestRevisionDate: [
                    {
                        timestamp: '1709239731',
                        raw: '1/2024/2/29/20/48/51/0'
                    }
                ],
                parentRegion: [],
                pageCount: [10],
                level: [5],
                overview: [],
                bestMonths: [],
                isMajorRegion: ['f'],
                isTopLevelRegion: ['f']
            }
        };

        const regionFalse = RopewikiRegion.fromResponseBody('Minor Region', rawFalse);
        expect(regionFalse.isMajorRegion).toBe(false);
        expect(regionFalse.isTopLevelRegion).toBe(false);
    });

    it('parses bestMonths array correctly', () => {
        const raw = {
            printouts: {
                latestRevisionDate: [
                    {
                        timestamp: '1709239731',
                        raw: '1/2024/2/29/20/48/51/0'
                    }
                ],
                parentRegion: [],
                pageCount: [25],
                level: [4],
                overview: [],
                bestMonths: ['March', 'April', 'May', 'September', 'October'],
                isMajorRegion: ['f'],
                isTopLevelRegion: ['f']
            }
        };

        const region = RopewikiRegion.fromResponseBody('Seasonal Region', raw);

        expect(region.bestMonths).toEqual(['March', 'April', 'May', 'September', 'October']);
        expect(region.bestMonths.length).toBe(5);
    });

    it('converts Unix timestamp correctly to Date', () => {
        const timestamp = 1709239731; // Unix timestamp in seconds
        const expectedDate = new Date(timestamp * 1000); // Convert to milliseconds

        const raw = {
            printouts: {
                latestRevisionDate: [
                    {
                        timestamp: String(timestamp),
                        raw: '1/2024/2/29/20/48/51/0'
                    }
                ],
                parentRegion: [],
                pageCount: [1],
                level: [1],
                overview: [],
                bestMonths: [],
                isMajorRegion: ['f'],
                isTopLevelRegion: ['f']
            }
        };

        const region = RopewikiRegion.fromResponseBody('Test Region', raw);

        expect(region.latestRevisionDate.getTime()).toBe(expectedDate.getTime());
    });

    it('handles parentRegion with missing fulltext', () => {
        const raw = {
            printouts: {
                latestRevisionDate: [
                    {
                        timestamp: '1709239731',
                        raw: '1/2024/2/29/20/48/51/0'
                    }
                ],
                parentRegion: [
                    {
                        fullurl: 'https://ropewiki.com/Parent_Region',
                        namespace: 0,
                        exists: '1',
                        displaytitle: ''
                        // missing fulltext
                    }
                ],
                pageCount: [10],
                level: [5],
                overview: [],
                bestMonths: [],
                isMajorRegion: ['f'],
                isTopLevelRegion: ['f']
            }
        };

        const region = RopewikiRegion.fromResponseBody('Test Region', raw);

        expect(region.parentRegion).toBeUndefined();
    });

    it('matches the example from ropewikiRegionsResponse.json', () => {
        // Test case based on "Zion National Park" from the JSON file
        const raw = {
            printouts: {
                latestRevisionDate: [
                    {
                        timestamp: '1709238662',
                        raw: '1/2024/2/29/20/31/2/0'
                    }
                ],
                parentRegion: [
                    {
                        fulltext: 'Southwest Utah',
                        fullurl: 'https://ropewiki.com/Southwest_Utah',
                        namespace: 0,
                        exists: '1',
                        displaytitle: ''
                    }
                ],
                pageCount: [86],
                level: [6],
                overview: [
                    'Zion National Park and surrounding region consists of many classic and picturesque sandstone slot canyons.'
                ],
                bestMonths: [],
                isMajorRegion: ['f'],
                isTopLevelRegion: ['f']
            }
        };

        const region = RopewikiRegion.fromResponseBody('Zion National Park', raw);

        expect(region.name).toBe('Zion National Park');
        expect(region.parentRegion).toBe('Southwest Utah');
        expect(region.pageCount).toBe(86);
        expect(region.level).toBe(6);
        expect(region.overview).toBe('Zion National Park and surrounding region consists of many classic and picturesque sandstone slot canyons.');
        expect(region.bestMonths).toEqual([]);
        expect(region.isMajorRegion).toBe(false);
        expect(region.isTopLevelRegion).toBe(false);
        expect(region.latestRevisionDate).toEqual(new Date(1709238662 * 1000));
        expect(region.url).toBe('https://ropewiki.com/Zion_National_Park');
    });

    it('generates url correctly with spaces replaced by underscores', () => {
        const raw = {
            printouts: {
                latestRevisionDate: [
                    {
                        timestamp: '1709239731',
                        raw: '1/2024/2/29/20/48/51/0'
                    }
                ],
                parentRegion: [],
                pageCount: [10],
                level: [1],
                overview: [],
                bestMonths: [],
                isMajorRegion: ['f'],
                isTopLevelRegion: ['f']
            }
        };

        // Test with spaces in name
        const regionWithSpaces = RopewikiRegion.fromResponseBody('Alta Verapaz', raw);
        expect(regionWithSpaces.url).toBe('https://ropewiki.com/Alta_Verapaz');

        // Test with multiple spaces
        const regionMultipleSpaces = RopewikiRegion.fromResponseBody('New South Wales', raw);
        expect(regionMultipleSpaces.url).toBe('https://ropewiki.com/New_South_Wales');

        // Test with no spaces
        const regionNoSpaces = RopewikiRegion.fromResponseBody('World', raw);
        expect(regionNoSpaces.url).toBe('https://ropewiki.com/World');

        // Test with leading/trailing spaces (should still work, but constructor handles it)
        const regionTrailingSpaces = RopewikiRegion.fromResponseBody('Region Name ', raw);
        expect(regionTrailingSpaces.url).toBe('https://ropewiki.com/Region_Name_');
    });
});
