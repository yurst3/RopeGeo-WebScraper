import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Pool } from 'pg';
import { main } from '../../src/ropewiki/main';
import type { ProcessPagesChunkHookFn } from '../../src/ropewiki/hook-functions/processPagesChunk';
import type { ProcessRopewikiRoutesHookFn } from '../../src/ropewiki/hook-functions/processRopewikiRoutes';
import type { MainEvent } from '../../src/ropewiki/types/mainEvent';
import RopewikiPage from '../../src/ropewiki/types/page';
import { RopewikiRegion } from '../../src/ropewiki/types/region';

const defaultMainEvent: MainEvent = { processPages: true, processRoutes: true };

// Mock all dependencies
jest.mock('../../src/helpers/getDatabaseConnection');
jest.mock('../../src/ropewiki/processors/processRegions');
jest.mock('../../src/ropewiki/util/getRegionsUnderLimit');
jest.mock('../../src/ropewiki/processors/processPagesForRegion');
jest.mock('../../src/ropewiki/processors/processRoutes');

import getDatabaseConnection from '../../src/helpers/getDatabaseConnection';
import processRegions from '../../src/ropewiki/processors/processRegions';
import getRegionCountsUnderLimit from '../../src/ropewiki/util/getRegionsUnderLimit';
import { getProcessPagesForRegionFn } from '../../src/ropewiki/processors/processPagesForRegion';
import processRoutes from '../../src/ropewiki/processors/processRoutes';

const mockGetDatabaseConnection = getDatabaseConnection as jest.MockedFunction<typeof getDatabaseConnection>;
const mockProcessRegions = processRegions as jest.MockedFunction<typeof processRegions>;
const mockGetRegionCountsUnderLimit = getRegionCountsUnderLimit as jest.MockedFunction<typeof getRegionCountsUnderLimit>;
const mockGetProcessPagesForRegionFn = getProcessPagesForRegionFn as jest.MockedFunction<typeof getProcessPagesForRegionFn>;
const mockProcessRoutes = processRoutes as jest.MockedFunction<typeof processRoutes>;

describe('main', () => {
    let mockPool: Pool;
    let mockProcessPagesChunkHookFn: jest.MockedFunction<ProcessPagesChunkHookFn>;
    let mockProcessRopewikiRoutesHookFn: jest.MockedFunction<ProcessRopewikiRoutesHookFn>;
    let mockProcessPagesForRegion: jest.MockedFunction<(regionName: string, regionPageCount: number, regionNameIds: {[name: string]: string}) => Promise<RopewikiPage[]>>;
    let consoleLogSpy: ReturnType<typeof jest.spyOn>;
    let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // Create mock pool
        mockPool = {
            end: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        } as unknown as Pool;

        // Create mock hook functions
        mockProcessPagesChunkHookFn = jest.fn<ProcessPagesChunkHookFn>().mockResolvedValue(undefined);
        mockProcessRopewikiRoutesHookFn = jest.fn<ProcessRopewikiRoutesHookFn>().mockResolvedValue(undefined);

        // Create mock processPagesForRegion function
        mockProcessPagesForRegion = jest.fn<(regionName: string, regionPageCount: number, regionNameIds: {[name: string]: string}) => Promise<RopewikiPage[]>>().mockResolvedValue([] as RopewikiPage[]);

        // Setup default mocks
        mockGetDatabaseConnection.mockResolvedValue(mockPool);
        mockProcessRegions.mockResolvedValue({ 'Region 1': 'region-id-1', 'Region 2': 'region-id-2' });
        mockGetRegionCountsUnderLimit.mockResolvedValue([]);
        mockGetProcessPagesForRegionFn.mockReturnValue(mockProcessPagesForRegion);
        mockProcessRoutes.mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.useRealTimers();
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    const createTestRegion = (name: string, pageCount: number): RopewikiRegion => {
        return new RopewikiRegion(
            name,
            undefined,
            pageCount,
            1,
            undefined,
            [],
            false,
            true,
            new Date('2024-01-01T00:00:00Z')
        );
    };

    const createTestPage = (pageid: string, name: string): RopewikiPage => {
        return new RopewikiPage(
            pageid,
            name,
            'test-region-id',
            'https://example.com/page',
            new Date(),
            { lat: 40, lon: -110 },
            undefined, // quality
            undefined, // rating
            undefined, // timeRating
            undefined, // kmlUrl
            undefined, // technicalRating
            undefined, // waterRating
            undefined, // riskRating
            undefined, // permits
            undefined, // rappelInfo
            undefined, // rappelCount
            undefined, // rappelLongest
            undefined, // months
            undefined, // shuttleTime
            undefined, // vehicle
            undefined, // minOverallTime
            undefined, // maxOverallTime
            undefined, // hikeLength
            undefined, // overallLength
            undefined, // minApproachTime
            undefined, // maxApproachTime
            undefined, // minDescentTime
            undefined, // maxDescentTime
            undefined, // minExitTime
            undefined, // maxExitTime
            undefined, // approachElevGain
            undefined, // exitElevGain
            [], // aka
            [], // betaSites
            undefined, // userVotes
            undefined, // id
        );
    };

    it('successfully processes regions and returns elapsed time', async () => {
        const region1 = createTestRegion('Region 1', 100);
        const region2 = createTestRegion('Region 2', 200);
        const regions = [region1, region2];
        const page1 = createTestPage('page-1', 'Page 1');
        const page2 = createTestPage('page-2', 'Page 2');

        mockGetRegionCountsUnderLimit.mockResolvedValue(regions);
        mockProcessPagesForRegion
            .mockResolvedValueOnce([page1])
            .mockResolvedValueOnce([page2]);

        const startTime = new Date('2024-01-01T00:00:00Z');
        jest.setSystemTime(startTime);

        const promise = main(defaultMainEvent, mockProcessPagesChunkHookFn, mockProcessRopewikiRoutesHookFn);

        // Advance time by 5 seconds
        jest.advanceTimersByTime(5000);

        const elapsedTime = await promise;

        expect(elapsedTime).toBe(5);
        expect(mockGetDatabaseConnection).toHaveBeenCalledTimes(1);
        expect(mockProcessRegions).toHaveBeenCalledWith(mockPool);
        expect(mockGetRegionCountsUnderLimit).toHaveBeenCalledWith(mockPool, 'World', 6000);
        expect(consoleLogSpy).toHaveBeenCalledWith('Getting pages from 2 regions: Region 1, Region 2');
        expect(mockGetProcessPagesForRegionFn).toHaveBeenCalledWith(mockPool, mockProcessPagesChunkHookFn, true);
        expect(mockProcessPagesForRegion).toHaveBeenCalledTimes(2);
        expect(mockProcessPagesForRegion).toHaveBeenNthCalledWith(1, 'Region 1', 100, { 'Region 1': 'region-id-1', 'Region 2': 'region-id-2' });
        expect(mockProcessPagesForRegion).toHaveBeenNthCalledWith(2, 'Region 2', 200, { 'Region 1': 'region-id-1', 'Region 2': 'region-id-2' });
        expect(mockProcessRoutes).toHaveBeenCalledWith(mockPool, [page1, page2], mockProcessRopewikiRoutesHookFn);
        expect(mockPool.end).toHaveBeenCalledTimes(1);
    });

    it('handles empty regions list', async () => {
        mockGetRegionCountsUnderLimit.mockResolvedValue([]);

        const startTime = new Date('2024-01-01T00:00:00Z');
        jest.setSystemTime(startTime);

        const promise = main(defaultMainEvent, mockProcessPagesChunkHookFn, mockProcessRopewikiRoutesHookFn);

        jest.advanceTimersByTime(1000);

        const elapsedTime = await promise;

        expect(elapsedTime).toBe(1);
        expect(consoleLogSpy).toHaveBeenCalledWith('Getting pages from 0 regions: ');
        expect(mockProcessPagesForRegion).not.toHaveBeenCalled();
        expect(mockProcessRoutes).toHaveBeenCalledWith(mockPool, [], mockProcessRopewikiRoutesHookFn);
        expect(mockPool.end).toHaveBeenCalledTimes(1);
    });

    it('handles single region', async () => {
        const region1 = createTestRegion('Region 1', 50);
        const page1 = createTestPage('page-1', 'Page 1');

        mockGetRegionCountsUnderLimit.mockResolvedValue([region1]);
        mockProcessPagesForRegion.mockResolvedValueOnce([page1]);

        const startTime = new Date('2024-01-01T00:00:00Z');
        jest.setSystemTime(startTime);

        const promise = main(defaultMainEvent, mockProcessPagesChunkHookFn, mockProcessRopewikiRoutesHookFn);

        jest.advanceTimersByTime(2000);

        const elapsedTime = await promise;

        expect(elapsedTime).toBe(2);
        expect(consoleLogSpy).toHaveBeenCalledWith('Getting pages from 1 regions: Region 1');
        expect(mockProcessPagesForRegion).toHaveBeenCalledTimes(1);
        expect(mockProcessRoutes).toHaveBeenCalledWith(mockPool, [page1], mockProcessRopewikiRoutesHookFn);
    });

    it('collects all parsed pages from all regions', async () => {
        const region1 = createTestRegion('Region 1', 100);
        const region2 = createTestRegion('Region 2', 200);
        const region3 = createTestRegion('Region 3', 300);
        const regions = [region1, region2, region3];
        const page1 = createTestPage('page-1', 'Page 1');
        const page2 = createTestPage('page-2', 'Page 2');
        const page3 = createTestPage('page-3', 'Page 3');
        const page4 = createTestPage('page-4', 'Page 4');

        mockGetRegionCountsUnderLimit.mockResolvedValue(regions);
        mockProcessPagesForRegion
            .mockResolvedValueOnce([page1])
            .mockResolvedValueOnce([page2, page3])
            .mockResolvedValueOnce([page4]);

        const startTime = new Date('2024-01-01T00:00:00Z');
        jest.setSystemTime(startTime);

        const promise = main(defaultMainEvent, mockProcessPagesChunkHookFn, mockProcessRopewikiRoutesHookFn);

        jest.advanceTimersByTime(3000);

        await promise;

        expect(mockProcessRoutes).toHaveBeenCalledWith(mockPool, [page1, page2, page3, page4], mockProcessRopewikiRoutesHookFn);
    });

    it('handles errors from processRegions', async () => {
        const error = new Error('Failed to process regions');
        mockProcessRegions.mockRejectedValue(error);

        const startTime = new Date('2024-01-01T00:00:00Z');
        jest.setSystemTime(startTime);

        const promise = main(defaultMainEvent, mockProcessPagesChunkHookFn, mockProcessRopewikiRoutesHookFn);

        jest.advanceTimersByTime(1000);

        await expect(promise).rejects.toThrow('Failed to process regions');
        expect(mockPool.end).toHaveBeenCalledTimes(1);
        expect(mockProcessRoutes).not.toHaveBeenCalled();
    });

    it('handles errors from getRegionCountsUnderLimit', async () => {
        const error = new Error('Failed to get regions');
        mockGetRegionCountsUnderLimit.mockRejectedValue(error);

        const startTime = new Date('2024-01-01T00:00:00Z');
        jest.setSystemTime(startTime);

        const promise = main(defaultMainEvent, mockProcessPagesChunkHookFn, mockProcessRopewikiRoutesHookFn);

        jest.advanceTimersByTime(1000);

        await expect(promise).rejects.toThrow('Failed to get regions');
        expect(mockPool.end).toHaveBeenCalledTimes(1);
        expect(mockProcessPagesForRegion).not.toHaveBeenCalled();
        expect(mockProcessRoutes).not.toHaveBeenCalled();
    });

    it('handles errors from processPagesForRegion', async () => {
        const region1 = createTestRegion('Region 1', 100);
        const error = new Error('Failed to process pages');
        
        mockGetRegionCountsUnderLimit.mockResolvedValue([region1]);
        mockProcessPagesForRegion.mockRejectedValue(error);

        const startTime = new Date('2024-01-01T00:00:00Z');
        jest.setSystemTime(startTime);

        const promise = main(defaultMainEvent, mockProcessPagesChunkHookFn, mockProcessRopewikiRoutesHookFn);

        jest.advanceTimersByTime(1000);

        await expect(promise).rejects.toThrow('Failed to process pages');
        expect(mockPool.end).toHaveBeenCalledTimes(1);
        expect(mockProcessRoutes).not.toHaveBeenCalled();
    });

    it('handles errors from processRoutes', async () => {
        const region1 = createTestRegion('Region 1', 100);
        const page1 = createTestPage('page-1', 'Page 1');
        const error = new Error('Failed to process routes');
        
        mockGetRegionCountsUnderLimit.mockResolvedValue([region1]);
        mockProcessPagesForRegion.mockResolvedValueOnce([page1]);
        mockProcessRoutes.mockRejectedValue(error);

        const startTime = new Date('2024-01-01T00:00:00Z');
        jest.setSystemTime(startTime);

        const promise = main(defaultMainEvent, mockProcessPagesChunkHookFn, mockProcessRopewikiRoutesHookFn);

        jest.advanceTimersByTime(1000);

        await expect(promise).rejects.toThrow('Failed to process routes');
        expect(mockPool.end).toHaveBeenCalledTimes(1);
    });

    it('always ends the pool connection in finally block', async () => {
        const region1 = createTestRegion('Region 1', 100);
        const error = new Error('Processing error');
        
        mockGetRegionCountsUnderLimit.mockResolvedValue([region1]);
        mockProcessPagesForRegion.mockRejectedValue(error);

        const startTime = new Date('2024-01-01T00:00:00Z');
        jest.setSystemTime(startTime);

        const promise = main(defaultMainEvent, mockProcessPagesChunkHookFn, mockProcessRopewikiRoutesHookFn);

        jest.advanceTimersByTime(1000);

        await expect(promise).rejects.toThrow('Processing error');
        
        // Verify pool.end is called even when an error occurs
        expect(mockPool.end).toHaveBeenCalledTimes(1);
    });

    it('returns correct elapsed time in seconds', async () => {
        const region1 = createTestRegion('Region 1', 100);
        const page1 = createTestPage('page-1', 'Page 1');

        mockGetRegionCountsUnderLimit.mockResolvedValue([region1]);
        mockProcessPagesForRegion.mockResolvedValueOnce([page1]);

        const startTime = new Date('2024-01-01T00:00:00Z');
        jest.setSystemTime(startTime);

        const promise = main(defaultMainEvent, mockProcessPagesChunkHookFn, mockProcessRopewikiRoutesHookFn);

        // Advance time by 7.5 seconds (should round down to 7)
        jest.advanceTimersByTime(7500);

        const elapsedTime = await promise;

        expect(elapsedTime).toBe(7);
    });

    it('handles regions with zero page count', async () => {
        const region1 = createTestRegion('Region 1', 0);
        const regions = [region1];

        mockGetRegionCountsUnderLimit.mockResolvedValue(regions);
        mockProcessPagesForRegion.mockResolvedValueOnce([]);

        const startTime = new Date('2024-01-01T00:00:00Z');
        jest.setSystemTime(startTime);

        const promise = main(defaultMainEvent, mockProcessPagesChunkHookFn, mockProcessRopewikiRoutesHookFn);

        jest.advanceTimersByTime(1000);

        await promise;

        expect(mockProcessPagesForRegion).toHaveBeenCalledWith('Region 1', 0, { 'Region 1': 'region-id-1', 'Region 2': 'region-id-2' });
        expect(mockProcessRoutes).toHaveBeenCalledWith(mockPool, [], mockProcessRopewikiRoutesHookFn);
    });

    it('does not call processRoutes when processRoutes is false', async () => {
        const region1 = createTestRegion('Region 1', 100);
        const page1 = createTestPage('page-1', 'Page 1');
        const event: MainEvent = { processPages: true, processRoutes: false };

        mockGetRegionCountsUnderLimit.mockResolvedValue([region1]);
        mockProcessPagesForRegion.mockResolvedValueOnce([page1]);

        const startTime = new Date('2024-01-01T00:00:00Z');
        jest.setSystemTime(startTime);

        const promise = main(event, mockProcessPagesChunkHookFn, mockProcessRopewikiRoutesHookFn);

        jest.advanceTimersByTime(2000);

        await promise;

        expect(mockProcessPagesForRegion).toHaveBeenCalledTimes(1);
        expect(mockProcessRoutes).not.toHaveBeenCalled();
    });

    it('passes processPages to getProcessPagesForRegionFn when processPages is false', async () => {
        const region1 = createTestRegion('Region 1', 100);
        const event: MainEvent = { processPages: false, processRoutes: true };

        mockGetRegionCountsUnderLimit.mockResolvedValue([region1]);
        mockProcessPagesForRegion.mockResolvedValueOnce([]);

        const startTime = new Date('2024-01-01T00:00:00Z');
        jest.setSystemTime(startTime);

        const promise = main(event, mockProcessPagesChunkHookFn, mockProcessRopewikiRoutesHookFn);

        jest.advanceTimersByTime(1000);

        await promise;

        expect(mockGetProcessPagesForRegionFn).toHaveBeenCalledWith(mockPool, mockProcessPagesChunkHookFn, false);
        expect(mockProcessRoutes).toHaveBeenCalledWith(mockPool, [], mockProcessRopewikiRoutesHookFn);
    });
});
