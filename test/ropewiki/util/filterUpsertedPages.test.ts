import { describe, it, expect } from '@jest/globals';
import filterUpsertedPages from '../../../src/ropewiki/util/filterUpsertedPages';
import RopewikiPage from '../../../src/ropewiki/types/page';

describe('filterUpsertedPages', () => {
    const regionNameIds = { 'Test Region': 'region-id-123' };

    const createPageWithCoordinates = (pageid: string, name: string, lat: number, lon: number): RopewikiPage => {
        const page = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: [pageid],
                name: [name],
                region: [{ fulltext: 'Test Region' }],
                url: [`https://ropewiki.com/${name.replace(/\s+/g, '_')}`],
                coordinates: [{ lat, lon }],
                latestRevisionDate: [{ timestamp: String(Math.floor(new Date('2024-01-01T00:00:00Z').getTime() / 1000)), raw: '2024-01-01T00:00:00Z' }],
            },
        }, regionNameIds);
        return page;
    };

    const createPageWithoutCoordinates = (pageid: string, name: string): RopewikiPage => {
        const page = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: [pageid],
                name: [name],
                region: [{ fulltext: 'Test Region' }],
                url: [`https://ropewiki.com/${name.replace(/\s+/g, '_')}`],
                latestRevisionDate: [{ timestamp: String(Math.floor(new Date('2024-01-01T00:00:00Z').getTime() / 1000)), raw: '2024-01-01T00:00:00Z' }],
            },
        }, regionNameIds);
        return page;
    };

    it('returns all pages when all have coordinates', () => {
        const page1 = createPageWithCoordinates('728', 'Page 1', 40.123, -111.456);
        const page2 = createPageWithCoordinates('5597', 'Page 2', 37.7749, -122.4194);
        const pages = [page1, page2];

        const result = filterUpsertedPages(pages);

        expect(result).toHaveLength(2);
        expect(result).toContain(page1);
        expect(result).toContain(page2);
    });

    it('filters out pages without coordinates', () => {
        const pageWithCoords = createPageWithCoordinates('728', 'Page With Coordinates', 40.123, -111.456);
        const pageWithoutCoords = createPageWithoutCoordinates('5597', 'Page Without Coordinates');
        const pages = [pageWithCoords, pageWithoutCoords];

        const result = filterUpsertedPages(pages);

        expect(result).toHaveLength(1);
        expect(result[0]).toBe(pageWithCoords);
        expect(result[0]!.pageid).toBe('728');
    });

    it('returns empty array when no pages have coordinates', () => {
        const page1 = createPageWithoutCoordinates('728', 'Page 1');
        const page2 = createPageWithoutCoordinates('5597', 'Page 2');
        const pages = [page1, page2];

        const result = filterUpsertedPages(pages);

        expect(result).toHaveLength(0);
    });

    it('returns empty array when input is empty', () => {
        const result = filterUpsertedPages([]);

        expect(result).toHaveLength(0);
    });

    it('handles mixed array with some pages having coordinates', () => {
        const page1 = createPageWithCoordinates('728', 'Page 1', 40.123, -111.456);
        const page2 = createPageWithoutCoordinates('5597', 'Page 2');
        const page3 = createPageWithCoordinates('9999', 'Page 3', 37.7749, -122.4194);
        const page4 = createPageWithoutCoordinates('8888', 'Page 4');
        const pages = [page1, page2, page3, page4];

        const result = filterUpsertedPages(pages);

        expect(result).toHaveLength(2);
        expect(result).toContain(page1);
        expect(result).toContain(page3);
        expect(result).not.toContain(page2);
        expect(result).not.toContain(page4);
    });

    it('preserves page order', () => {
        const page1 = createPageWithCoordinates('728', 'Page 1', 40.123, -111.456);
        const page2 = createPageWithoutCoordinates('5597', 'Page 2');
        const page3 = createPageWithCoordinates('9999', 'Page 3', 37.7749, -122.4194);
        const pages = [page1, page2, page3];

        const result = filterUpsertedPages(pages);

        expect(result).toHaveLength(2);
        expect(result[0]).toBe(page1);
        expect(result[1]).toBe(page3);
    });

    it('handles pages with undefined coordinates explicitly set', () => {
        const page = createPageWithoutCoordinates('728', 'Test Page');
        // Explicitly ensure coordinates is undefined
        page.coordinates = undefined;
        
        const result = filterUpsertedPages([page]);

        expect(result).toHaveLength(0);
    });
});
