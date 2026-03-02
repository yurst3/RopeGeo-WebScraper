import { describe, it, expect, afterEach, jest } from '@jest/globals';
import updateLengthsForPages from '../../../src/ropewiki/util/updateLengthsForPages';
import getLengthAndElevGains from '../../../src/ropewiki/http/getLengthAndElevGains';
import RopewikiPage from '../../../src/ropewiki/types/page';

jest.mock('../../../src/ropewiki/http/getLengthAndElevGains', () => ({
    __esModule: true,
    default: jest.fn(),
}));

const mockGetLengthAndElevGains = jest.mocked(getLengthAndElevGains);

const regionNameIds = { 'Test Region': 'region-id-123' };
const validLatestRevisionDate = [
    { timestamp: String(Math.floor(new Date('2024-01-01T00:00:00Z').getTime() / 1000)), raw: '2024-01-01T00:00:00Z' },
];

function createPage(pageid: string, name: string, withLengthData = false): RopewikiPage {
    const page = RopewikiPage.fromResponseBody(
        {
            printouts: {
                pageid: [pageid],
                name: [name],
                region: [{ fulltext: 'Test Region' }],
                url: [`https://ropewiki.com/${name.replace(/\s+/g, '_')}`],
                latestRevisionDate: validLatestRevisionDate,
            },
        },
        regionNameIds,
    );
    if (withLengthData) {
        page.setLengthsAndElevGains({
            overallLength: 5,
            approachLength: 2,
            approachElevGain: 500,
            descentLength: 2,
            descentElevGain: -400,
            exitLength: 1,
            exitElevGain: -100,
        });
    }
    return page;
}

describe('updateLengthsForPages', () => {
    afterEach(() => {
        mockGetLengthAndElevGains.mockClear();
    });

    it('does not call getLengthAndElevGains when pages is empty', async () => {
        await updateLengthsForPages([]);
        expect(mockGetLengthAndElevGains).not.toHaveBeenCalled();
    });

    it('does not call getLengthAndElevGains when no pages need length updates (no length data)', async () => {
        const page1 = createPage('728', 'Page 1', false);
        const page2 = createPage('5597', 'Page 2', false);
        await updateLengthsForPages([page1, page2]);
        expect(mockGetLengthAndElevGains).not.toHaveBeenCalled();
    });

    it('calls getLengthAndElevGains with pageids of pages that need length updates and sets data on pages', async () => {
        const page1 = createPage('728', 'Page 1', true);
        const page2 = createPage('5597', 'Page 2', true);
        mockGetLengthAndElevGains.mockResolvedValue({
            '728': {
                overallLength: 6.8,
                approachLength: 4,
                approachElevGain: 2700,
                descentLength: 1.8,
                descentElevGain: -1800,
                exitLength: 0.9,
                exitElevGain: -600,
            },
            '5597': {
                overallLength: 3,
                approachLength: 1,
                approachElevGain: 200,
                descentLength: 1.5,
                descentElevGain: -300,
                exitLength: 0.5,
                exitElevGain: -100,
            },
        });

        await updateLengthsForPages([page1, page2]);

        expect(mockGetLengthAndElevGains).toHaveBeenCalledTimes(1);
        expect(mockGetLengthAndElevGains).toHaveBeenCalledWith(['728', '5597']);
        expect(page1.overallLength).toBe(6.8);
        expect(page1.approachLength).toBe(4);
        expect(page1.approachElevGain).toBe(2700);
        expect(page1.descentLength).toBe(1.8);
        expect(page1.descentElevGain).toBe(-1800);
        expect(page1.exitLength).toBe(0.9);
        expect(page1.exitElevGain).toBe(-600);
        expect(page2.overallLength).toBe(3);
        expect(page2.approachLength).toBe(1);
        expect(page2.approachElevGain).toBe(200);
    });

    it('only requests pageids for pages that need updates; applies results to all pages that have data', async () => {
        const pageNeedsUpdate = createPage('100', 'Needs Update', true);
        const pageNoLengthData = createPage('200', 'No Length Data', false);
        mockGetLengthAndElevGains.mockResolvedValue({
            '100': {
                overallLength: 2,
                approachLength: 0.5,
                approachElevGain: 100,
                descentLength: 1,
                descentElevGain: -80,
                exitLength: 0.5,
                exitElevGain: -20,
            },
        });

        await updateLengthsForPages([pageNeedsUpdate, pageNoLengthData]);

        expect(mockGetLengthAndElevGains).toHaveBeenCalledWith(['100']);
        expect(pageNeedsUpdate.overallLength).toBe(2);
        expect(pageNoLengthData.overallLength).toBeUndefined(); // unchanged, had no length data
    });

    it('applies data only to pages that appear in the response', async () => {
        const page1 = createPage('1', 'One', true);
        const page2 = createPage('2', 'Two', false);
        mockGetLengthAndElevGains.mockResolvedValue({
            '1': {
                overallLength: 1,
                approachLength: 0,
                approachElevGain: 0,
                descentLength: 1,
                descentElevGain: -100,
                exitLength: 0,
                exitElevGain: 0,
            },
        });

        await updateLengthsForPages([page1, page2]);

        expect(page1.overallLength).toBe(1);
        expect(page2.overallLength).toBeUndefined();
    });
});
