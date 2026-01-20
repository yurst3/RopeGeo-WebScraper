import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Pool, PoolClient } from 'pg';
import * as db from 'zapatos/db';
import { getProcessPagesForRegionFn } from '../../../src/ropewiki/processors/processPagesForRegion';
import type { ProcessPagesChunkHookFn } from '../../../src/ropewiki/hook-functions/processPagesChunk';
import RopewikiPage from '../../../src/ropewiki/types/page';
import ProgressLogger from '../../../src/helpers/progressLogger';

// Mock all dependencies
jest.mock('../../../src/ropewiki/http/getRopewikiPageForRegion');
jest.mock('../../../src/ropewiki/database/getUpdatedDatesForPages');
jest.mock('../../../src/ropewiki/database/upsertPages');
jest.mock('../../../src/helpers/progressLogger');

import getRopewikiPageForRegion from '../../../src/ropewiki/http/getRopewikiPageForRegion';
import getUpdatedDatesForPages from '../../../src/ropewiki/database/getUpdatedDatesForPages';
import upsertPages from '../../../src/ropewiki/database/upsertPages';

const mockGetRopewikiPageForRegion = getRopewikiPageForRegion as jest.MockedFunction<typeof getRopewikiPageForRegion>;
const mockGetUpdatedDatesForPages = getUpdatedDatesForPages as jest.MockedFunction<typeof getUpdatedDatesForPages>;
const mockUpsertPages = upsertPages as jest.MockedFunction<typeof upsertPages>;
const MockedProgressLogger = ProgressLogger as jest.MockedClass<typeof ProgressLogger>;

describe('processPagesForRegion', () => {
    let mockPool: Pool;
    let mockClient: {
        query: jest.MockedFunction<(query: string) => Promise<unknown>>;
        release: jest.MockedFunction<() => void>;
    };
    let consoleLogSpy: ReturnType<typeof jest.spyOn>;
    let consoleErrorSpy: ReturnType<typeof jest.spyOn>;
    let mockProcessPagesChunkHookFn: jest.MockedFunction<ProcessPagesChunkHookFn>;
    let mockLoggerInstance: {
        setChunk: jest.MockedFunction<(start: number, end: number) => void>;
        logProgress: jest.MockedFunction<(message: string) => void>;
    };
    let processPagesForRegion: ReturnType<typeof getProcessPagesForRegionFn>;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        
        // Create mock client with query and release methods
        mockClient = {
            query: jest.fn<typeof mockClient.query>().mockResolvedValue({}),
            release: jest.fn<typeof mockClient.release>(),
        };
        
        // Create mock pool with connect method
        mockPool = {
            connect: jest.fn<() => Promise<typeof mockClient>>().mockResolvedValue(mockClient),
        } as unknown as Pool;
        
        // Create mock logger instance
        mockLoggerInstance = {
            setChunk: jest.fn(),
            logProgress: jest.fn(),
        };
        
        // Mock ProgressLogger constructor to return our mock instance
        MockedProgressLogger.mockImplementation(() => mockLoggerInstance as unknown as ProgressLogger);
        
        // Create mock ProcessPagesChunkHookFn
        mockProcessPagesChunkHookFn = jest.fn<ProcessPagesChunkHookFn>().mockResolvedValue(undefined);
        
        // Get the processPagesForRegion function using getProcessPagesForRegionFn
        processPagesForRegion = getProcessPagesForRegionFn(mockPool, mockProcessPagesChunkHookFn);
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    const createValidPage = (pageid: string, name: string, region: string, regionNameIds: {[name: string]: string}, revisionDate?: Date): RopewikiPage => {
        const date = revisionDate || new Date('2024-01-01T00:00:00Z');
        const timestamp = Math.floor(date.getTime() / 1000).toString();
        return RopewikiPage.fromResponseBody({
            printouts: {
                pageid: [pageid],
                name: [name],
                region: [{ fulltext: region }],
                url: [`https://ropewiki.com/${name.replace(/\s+/g, '_')}`],
                latestRevisionDate: [{ timestamp, raw: '1/2021/1/1/0/0/0/0' }],
            },
        }, regionNameIds);
    };

    const createInvalidPage = (pageid: string, regionNameIds: {[name: string]: string}): RopewikiPage => {
        return RopewikiPage.fromResponseBody({
            printouts: {
                pageid: [pageid],
                name: [], // Missing name makes it invalid
                region: [],
                url: [],
                latestRevisionDate: [], // Missing latestRevisionDate also makes it invalid
            },
        }, regionNameIds);
    };

    const createUpsertedPage = (pageid: string, name: string, region: string, regionNameIds: {[name: string]: string}, id: string, revisionDate?: Date): RopewikiPage => {
        const page = createValidPage(pageid, name, region, regionNameIds, revisionDate);
        page.id = id;
        return page;
    };

    it('processes pages when count is under 2000', async () => {
        const regionName = 'Test Region';
        const regionPageCount = 100;
        const regionNameIds = { 'Test Region': 'region-id-123' };

        const page1 = createValidPage('728', 'Page 1', regionName, regionNameIds, new Date('2024-01-01T00:00:00Z'));
        const page2 = createValidPage('5597', 'Page 2', regionName, regionNameIds, new Date('2024-01-02T00:00:00Z'));
        const pages = [page1, page2];

        mockGetRopewikiPageForRegion.mockResolvedValue(pages);
        mockGetUpdatedDatesForPages.mockResolvedValue({
            '728': null,
            '5597': null,
        });
        const upsertedPage1 = createUpsertedPage('728', 'Page 1', regionName, regionNameIds, 'page-uuid-1', new Date('2024-01-01T00:00:00Z'));
        const upsertedPage2 = createUpsertedPage('5597', 'Page 2', regionName, regionNameIds, 'page-uuid-2', new Date('2024-01-02T00:00:00Z'));
        mockUpsertPages.mockResolvedValueOnce([upsertedPage1, upsertedPage2]);
        mockProcessPagesChunkHookFn.mockResolvedValue(undefined);

        await processPagesForRegion(regionName, regionPageCount, regionNameIds);

        expect(mockGetRopewikiPageForRegion).toHaveBeenCalledTimes(1);
        expect(mockGetRopewikiPageForRegion).toHaveBeenCalledWith(regionName, 0, 2000, regionNameIds);
        // Verify getUpdatedDatesForPages is called before upsertPages (with valid page IDs from the fetched pages)
        expect(mockGetUpdatedDatesForPages).toHaveBeenCalledWith(mockPool, ['728', '5597']);
        expect(mockGetUpdatedDatesForPages).toHaveBeenCalledTimes(1);
        expect(mockUpsertPages).toHaveBeenCalledTimes(1);
        // Verify call order: getUpdatedDatesForPages should be called before upsertPages
        expect(mockGetUpdatedDatesForPages.mock.invocationCallOrder[0]).toBeLessThan(mockUpsertPages.mock.invocationCallOrder[0]!);
        expect(mockProcessPagesChunkHookFn).toHaveBeenCalledTimes(1);
        expect(mockLoggerInstance.setChunk).toHaveBeenCalledWith(0, 1); // offset=0, skippedInChunk=0, chunkEnd=0+2-1=1
        expect(mockProcessPagesChunkHookFn).toHaveBeenCalledWith(
            mockClient as unknown as PoolClient,
            expect.arrayContaining([
                expect.objectContaining({ id: expect.any(String), pageid: '728', name: 'Page 1', latestRevisionDate: expect.any(Date) }),
                expect.objectContaining({ id: expect.any(String), pageid: '5597', name: 'Page 2', latestRevisionDate: expect.any(Date) }),
            ]),
            mockLoggerInstance
        );
    });

    it('processes pages in chunks when count exceeds 2000', async () => {
        const regionName = 'Test Region';
        const regionPageCount = 3500;
        const regionNameIds = { 'Test Region': 'region-id-123' };

        const chunk1Pages = Array.from({ length: 2000 }, (_, i) => createValidPage(`${i + 1}`, `Page ${i + 1}`, regionName, regionNameIds, new Date('2024-01-01T00:00:00Z')));
        const chunk2Pages = Array.from({ length: 1500 }, (_, i) => createValidPage(`${i + 2001}`, `Page ${i + 2001}`, regionName, regionNameIds, new Date('2024-01-01T00:00:00Z')));

        mockGetRopewikiPageForRegion
            .mockResolvedValueOnce(chunk1Pages)
            .mockResolvedValueOnce(chunk2Pages);

        const chunk1PageIds = chunk1Pages.map(p => p.pageid);
        const chunk2PageIds = chunk2Pages.map(p => p.pageid);

        const chunk1UpdateDates = Object.fromEntries(chunk1PageIds.map(id => [id, null]));
        const chunk2UpdateDates = Object.fromEntries(chunk2PageIds.map(id => [id, null]));

        // getUpdatedDatesForPages is called BEFORE upsertPages for each chunk
        mockGetUpdatedDatesForPages
            .mockResolvedValueOnce(chunk1UpdateDates)
            .mockResolvedValueOnce(chunk2UpdateDates);

        mockUpsertPages.mockImplementation((_, pages: RopewikiPage[]) => 
            Promise.resolve(pages.map(pageInfo => {
                const upserted = RopewikiPage.fromResponseBody({
                    printouts: {
                        pageid: [pageInfo.pageid],
                        name: [pageInfo.name],
                        region: [{ fulltext: regionName }],
                        url: [pageInfo.url],
                        latestRevisionDate: [{ timestamp: String(Math.floor(pageInfo.latestRevisionDate.getTime() / 1000)), raw: pageInfo.latestRevisionDate.toISOString() }],
                    },
                }, regionNameIds);
                upserted.id = `uuid-${pageInfo.pageid}`;
                return upserted;
            }))
        );
        mockProcessPagesChunkHookFn.mockResolvedValue(undefined);

        await processPagesForRegion(regionName, regionPageCount, regionNameIds);

        expect(mockGetRopewikiPageForRegion).toHaveBeenCalledTimes(2);
        expect(mockGetRopewikiPageForRegion).toHaveBeenNthCalledWith(1, regionName, 0, 2000, regionNameIds);
        expect(mockGetRopewikiPageForRegion).toHaveBeenNthCalledWith(2, regionName, 2000, 2000, regionNameIds);
        expect(mockGetUpdatedDatesForPages).toHaveBeenCalledTimes(2);
        // Verify getUpdatedDatesForPages is called before upsertPages for each chunk
        expect(mockGetUpdatedDatesForPages.mock.invocationCallOrder[0]).toBeLessThan(mockUpsertPages.mock.invocationCallOrder[0]!);
        expect(mockGetUpdatedDatesForPages.mock.invocationCallOrder[1]).toBeLessThan(mockUpsertPages.mock.invocationCallOrder[1]!);
        expect(mockProcessPagesChunkHookFn).toHaveBeenCalledTimes(2);
        expect(mockLoggerInstance.setChunk).toHaveBeenCalledTimes(2);
        expect(mockLoggerInstance.setChunk).toHaveBeenNthCalledWith(1, 0, 1999); // First chunk: offset=0, skippedInChunk=0, chunkEnd=0+2000-1=1999
        expect(mockLoggerInstance.setChunk).toHaveBeenNthCalledWith(2, 2000, 3499); // Second chunk: offset=2000, skippedInChunk=0, chunkEnd=2000+1500-1=3499
    });

    it('filters out invalid pages', async () => {
        const regionName = 'Test Region';
        const regionPageCount = 3;
        const regionNameIds = { 'Test Region': 'region-id-123' };

        const validPage = createValidPage('728', 'Valid Page', regionName, regionNameIds, new Date('2024-01-01T00:00:00Z'));
        const invalidPage1 = createInvalidPage('9999', regionNameIds);
        const invalidPage2 = createInvalidPage('9998', regionNameIds);
        const pages = [validPage, invalidPage1, invalidPage2];

        mockGetRopewikiPageForRegion.mockResolvedValue(pages);
        mockGetUpdatedDatesForPages.mockResolvedValue({
            '728': null,
        });
        const upsertedPage1 = createUpsertedPage('728', 'Page 1', regionName, regionNameIds, 'page-uuid-1', new Date('2024-01-01T00:00:00Z'));
        mockUpsertPages.mockResolvedValueOnce([upsertedPage1]);
        mockProcessPagesChunkHookFn.mockResolvedValue(undefined);

        await processPagesForRegion(regionName, regionPageCount, regionNameIds);

        expect(consoleLogSpy).toHaveBeenCalledWith('Skipping 2 invalid pages...');
        // Verify getUpdatedDatesForPages is called before upsertPages, only with valid page IDs
        expect(mockGetUpdatedDatesForPages).toHaveBeenCalledWith(mockPool, ['728']);
        expect(mockGetUpdatedDatesForPages.mock.invocationCallOrder[0]).toBeLessThan(mockUpsertPages.mock.invocationCallOrder[0]!);
        expect(mockLoggerInstance.setChunk).toHaveBeenCalledWith(2, 2); // offset=0, skippedInChunk=2 (2 invalid), chunkEnd=0+2+1-1=2
        expect(mockProcessPagesChunkHookFn).toHaveBeenCalledWith(
            mockClient as unknown as PoolClient,
            expect.arrayContaining([
                expect.objectContaining({ id: expect.any(String), pageid: '728', name: expect.any(String), latestRevisionDate: expect.any(Date) }),
            ]),
            mockLoggerInstance
        );
    });

    it('skips pages where updatedDate is after revisionDate', async () => {
        const regionName = 'Test Region';
        const regionPageCount = 2;
        const regionNameIds = { 'Test Region': 'region-id-123' };

        const page1 = createValidPage('728', 'Page 1', regionName, regionNameIds, new Date('2024-01-01T00:00:00Z'));
        const page2 = createValidPage('5597', 'Page 2', regionName, regionNameIds, new Date('2024-01-02T00:00:00Z'));
        const pages = [page1, page2];

        mockGetRopewikiPageForRegion.mockResolvedValue(pages);
        // getUpdatedDatesForPages is called BEFORE upsertPages
        mockGetUpdatedDatesForPages.mockResolvedValue({
            '728': new Date('2024-01-02T00:00:00Z'), // Updated after revision
            '5597': new Date('2024-01-03T00:00:00Z'), // Updated after revision
        });
        // upsertPages returns the upserted pages
        const upsertedPage1 = createUpsertedPage('728', 'Page 1', regionName, regionNameIds, 'page-uuid-1', new Date('2024-01-01T00:00:00Z'));
        const upsertedPage2 = createUpsertedPage('5597', 'Page 2', regionName, regionNameIds, 'page-uuid-2', new Date('2024-01-02T00:00:00Z'));
        mockUpsertPages.mockResolvedValueOnce([upsertedPage1, upsertedPage2]);
        mockProcessPagesChunkHookFn.mockResolvedValue(undefined);

        await processPagesForRegion(regionName, regionPageCount, regionNameIds);

        // Verify getUpdatedDatesForPages is called before upsertPages (with valid page IDs from the fetched pages)
        expect(mockGetUpdatedDatesForPages).toHaveBeenCalledWith(mockPool, ['728', '5597']);
        expect(mockGetUpdatedDatesForPages).toHaveBeenCalledTimes(1);
        expect(mockUpsertPages).toHaveBeenCalledTimes(1);
        // Verify call order: getUpdatedDatesForPages should be called before upsertPages
        expect(mockGetUpdatedDatesForPages.mock.invocationCallOrder[0]).toBeLessThan(mockUpsertPages.mock.invocationCallOrder[0]!);
        expect(consoleLogSpy).toHaveBeenCalledWith('Skipping parsing for 2 pages...');
        expect(mockProcessPagesChunkHookFn).not.toHaveBeenCalled();
    });

    it('processes pages where updatedDate is before revisionDate', async () => {
        const regionName = 'Test Region';
        const regionPageCount = 2;
        const regionNameIds = { 'Test Region': 'region-id-123' };

        const page1 = createValidPage('728', 'Page 1', regionName, regionNameIds, new Date('2024-01-03T00:00:00Z'));
        const page2 = createValidPage('5597', 'Page 2', regionName, regionNameIds, new Date('2024-01-04T00:00:00Z'));
        const pages = [page1, page2];

        mockGetRopewikiPageForRegion.mockResolvedValue(pages);
        // getUpdatedDatesForPages is called BEFORE upsertPages
        mockGetUpdatedDatesForPages.mockResolvedValue({
            '728': new Date('2024-01-01T00:00:00Z'), // Updated before revision
            '5597': new Date('2024-01-02T00:00:00Z'), // Updated before revision
        });
        // upsertPages returns the upserted pages
        const upsertedPage1 = createUpsertedPage('728', 'Page 1', regionName, regionNameIds, 'page-uuid-1', new Date('2024-01-03T00:00:00Z'));
        const upsertedPage2 = createUpsertedPage('5597', 'Page 2', regionName, regionNameIds, 'page-uuid-2', new Date('2024-01-04T00:00:00Z'));
        mockUpsertPages.mockResolvedValueOnce([upsertedPage1, upsertedPage2]);
        mockProcessPagesChunkHookFn.mockResolvedValue(undefined);

        await processPagesForRegion(regionName, regionPageCount, regionNameIds);

        // Verify getUpdatedDatesForPages is called before upsertPages (with valid page IDs from the fetched pages)
        expect(mockGetUpdatedDatesForPages).toHaveBeenCalledWith(mockPool, ['728', '5597']);
        expect(mockGetUpdatedDatesForPages).toHaveBeenCalledTimes(1);
        expect(mockUpsertPages).toHaveBeenCalledTimes(1);
        // Verify call order: getUpdatedDatesForPages should be called before upsertPages
        expect(mockGetUpdatedDatesForPages.mock.invocationCallOrder[0]).toBeLessThan(mockUpsertPages.mock.invocationCallOrder[0]!);
        expect(mockProcessPagesChunkHookFn).toHaveBeenCalledTimes(1);
        expect(mockLoggerInstance.setChunk).toHaveBeenCalledWith(0, 1); // offset=0, skippedInChunk=0, chunkEnd=0+2-1=1
        expect(mockProcessPagesChunkHookFn).toHaveBeenCalledWith(
            mockClient as unknown as PoolClient,
            expect.arrayContaining([
                expect.objectContaining({ id: expect.any(String), pageid: '728', name: 'Page 1', latestRevisionDate: expect.any(Date) }),
                expect.objectContaining({ id: expect.any(String), pageid: '5597', name: 'Page 2', latestRevisionDate: expect.any(Date) }),
            ]),
            mockLoggerInstance
        );
    });

    it('processes pages where updatedDate is null', async () => {
        const regionName = 'Test Region';
        const regionPageCount = 1;
        const regionNameIds = { 'Test Region': 'region-id-123' };

        const page = createValidPage('728', 'Page 1', regionName, regionNameIds, new Date('2024-01-01T00:00:00Z'));
        const pages = [page];

        mockGetRopewikiPageForRegion.mockResolvedValue(pages);
        mockGetUpdatedDatesForPages.mockResolvedValue({
            '728': null, // No update date
        });
        const upsertedPage1 = createUpsertedPage('728', 'Page 1', regionName, regionNameIds, 'page-uuid-1', new Date('2024-01-01T00:00:00Z'));
        mockUpsertPages.mockResolvedValueOnce([upsertedPage1]);
        mockProcessPagesChunkHookFn.mockResolvedValue(undefined);

        await processPagesForRegion(regionName, regionPageCount, regionNameIds);

        // Verify getUpdatedDatesForPages is called before upsertPages
        expect(mockGetUpdatedDatesForPages.mock.invocationCallOrder[0]).toBeLessThan(mockUpsertPages.mock.invocationCallOrder[0]!);
        expect(mockProcessPagesChunkHookFn).toHaveBeenCalledTimes(1);
        expect(mockLoggerInstance.setChunk).toHaveBeenCalledWith(0, 0); // offset=0, skippedInChunk=0, chunkEnd=0+1-1=0
        expect(mockProcessPagesChunkHookFn).toHaveBeenCalledWith(
            mockClient as unknown as PoolClient,
            expect.arrayContaining([
                expect.objectContaining({ id: expect.any(String), pageid: '728', name: expect.any(String), latestRevisionDate: expect.any(Date) }),
            ]),
            mockLoggerInstance
        );
    });

    it('skips pages where revisionDate is null', async () => {
        const regionName = 'Test Region';
        const regionPageCount = 2;
        const regionNameIds = { 'Test Region': 'region-id-123' };

        const page1 = createInvalidPage('728', regionNameIds); // Invalid page has no revision date
        const page2 = createValidPage('5597', 'Page 2', regionName, regionNameIds, new Date('2024-01-01T00:00:00Z'));
        const pages = [page1, page2];

        mockGetRopewikiPageForRegion.mockResolvedValue(pages);
        // getUpdatedDatesForPages is called BEFORE upsertPages, only for valid pages (page1 is invalid)
        mockGetUpdatedDatesForPages.mockResolvedValue({
            '5597': null,
        });
        const upsertedPage2 = createUpsertedPage('5597', 'Page 2', regionName, regionNameIds, 'page-uuid-2', new Date('2024-01-01T00:00:00Z'));
        mockUpsertPages.mockResolvedValueOnce([upsertedPage2]);
        mockProcessPagesChunkHookFn.mockResolvedValue(undefined);

        await processPagesForRegion(regionName, regionPageCount, regionNameIds);

        // Verify getUpdatedDatesForPages is called before upsertPages, only with valid page IDs
        expect(mockGetUpdatedDatesForPages).toHaveBeenCalledWith(mockPool, ['5597']);
        expect(mockGetUpdatedDatesForPages.mock.invocationCallOrder[0]).toBeLessThan(mockUpsertPages.mock.invocationCallOrder[0]!);
        expect(mockProcessPagesChunkHookFn).toHaveBeenCalledTimes(1);
        expect(mockLoggerInstance.setChunk).toHaveBeenCalledWith(1, 1); // offset=0, skippedInChunk=1 (page1 is invalid), chunkEnd=0+1+1-1=1
        expect(mockProcessPagesChunkHookFn).toHaveBeenCalledWith(
            mockClient as unknown as PoolClient,
            expect.arrayContaining([
                expect.objectContaining({ id: expect.any(String), pageid: '5597', name: expect.any(String), latestRevisionDate: expect.any(Date) }),
            ]),
            mockLoggerInstance
        );
    });

    it('propagates errors from getRopewikiPageForRegion()', async () => {
        const regionName = 'Test Region';
        const regionPageCount = 100;
        const regionNameIds = { 'Test Region': 'region-id-123' };

        const error = new Error('API error');
        mockGetRopewikiPageForRegion.mockRejectedValue(error);

        await expect(processPagesForRegion(regionName, regionPageCount, regionNameIds)).rejects.toThrow('API error');
    });

    it('propagates errors from getUpdatedDatesForPages()', async () => {
        const regionName = 'Test Region';
        const regionPageCount = 1;
        const regionNameIds = { 'Test Region': 'region-id-123' };

        const page = createValidPage('728', 'Page 1', regionName, regionNameIds, new Date('2024-01-01T00:00:00Z'));
        mockGetRopewikiPageForRegion.mockResolvedValue([page]);

        const error = new Error('Database error');
        mockGetUpdatedDatesForPages.mockRejectedValue(error);

        await expect(processPagesForRegion(regionName, regionPageCount, regionNameIds)).rejects.toThrow('Database error');
    });

    it('propagates errors from processPage()', async () => {
        const regionName = 'Test Region';
        const regionPageCount = 1;
        const regionNameIds = { 'Test Region': 'region-id-123' };

        const page = createValidPage('728', 'Page 1', regionName, regionNameIds, new Date('2024-01-01T00:00:00Z'));
        mockGetRopewikiPageForRegion.mockResolvedValue([page]);
        mockGetUpdatedDatesForPages.mockResolvedValue({
            '728': null,
        });
        const upsertedPage1 = createUpsertedPage('728', 'Page 1', regionName, regionNameIds, 'page-uuid-1', new Date('2024-01-01T00:00:00Z'));
        mockUpsertPages.mockResolvedValueOnce([upsertedPage1]);

        const error = new Error('Process pages error');
        mockProcessPagesChunkHookFn.mockRejectedValue(error);

        await expect(processPagesForRegion(regionName, regionPageCount, regionNameIds)).rejects.toThrow('Process pages error');
    });

    it('does not call processPage when no pages need processing', async () => {
        const regionName = 'Test Region';
        const regionPageCount = 1;
        const regionNameIds = { 'Test Region': 'region-id-123' };

        const page = createInvalidPage('728', regionNameIds); // Invalid page has no revision date, so page will be filtered out
        mockGetRopewikiPageForRegion.mockResolvedValue([page]);
        mockGetUpdatedDatesForPages.mockResolvedValue({
            '728': null,
        });

        await processPagesForRegion(regionName, regionPageCount, regionNameIds);

        expect(mockProcessPagesChunkHookFn).not.toHaveBeenCalled();
    });

    it('handles mixed scenarios with some pages processed and some skipped', async () => {
        const regionName = 'Test Region';
        const regionPageCount = 3;
        const regionNameIds = { 'Test Region': 'region-id-123' };

        const page1 = createValidPage('728', 'Page 1', regionName, regionNameIds, new Date('2024-01-03T00:00:00Z'));
        const page2 = createValidPage('5597', 'Page 2', regionName, regionNameIds, new Date('2024-01-02T00:00:00Z'));
        const page3 = createInvalidPage('9999', regionNameIds); // Invalid page has no revision date
        const pages = [page1, page2, page3];

        mockGetRopewikiPageForRegion.mockResolvedValue(pages);
        // getUpdatedDatesForPages is called BEFORE upsertPages, only for valid pages
        mockGetUpdatedDatesForPages.mockResolvedValue({
            '728': new Date('2024-01-01T00:00:00Z'), // Updated before revision - should process
            '5597': new Date('2024-01-03T00:00:00Z'), // Updated after revision - should skip
        });
        // upsertPages returns all valid pages (page3 is invalid, so not included)
        const upsertedPage1 = createUpsertedPage('728', 'Page 1', regionName, regionNameIds, 'page-uuid-1', new Date('2024-01-03T00:00:00Z'));
        const upsertedPage2 = createUpsertedPage('5597', 'Page 2', regionName, regionNameIds, 'page-uuid-2', new Date('2024-01-02T00:00:00Z'));
        mockUpsertPages.mockResolvedValueOnce([upsertedPage1, upsertedPage2]);
        mockProcessPagesChunkHookFn.mockResolvedValue(undefined);

        await processPagesForRegion(regionName, regionPageCount, regionNameIds);

        // Verify getUpdatedDatesForPages is called before upsertPages, only with valid page IDs
        expect(mockGetUpdatedDatesForPages).toHaveBeenCalledWith(mockPool, ['728', '5597']);
        expect(mockGetUpdatedDatesForPages.mock.invocationCallOrder[0]).toBeLessThan(mockUpsertPages.mock.invocationCallOrder[0]!);
        expect(consoleLogSpy).toHaveBeenCalledWith('Skipping parsing for 1 pages...');
        expect(mockProcessPagesChunkHookFn).toHaveBeenCalledTimes(1);
        expect(mockLoggerInstance.setChunk).toHaveBeenCalledWith(2, 2); // offset=0, skippedInChunk=2 (page2 updated after revision, page3 invalid), chunkEnd=0+2+1-1=2
        expect(mockProcessPagesChunkHookFn).toHaveBeenCalledWith(
            mockClient as unknown as PoolClient,
            expect.arrayContaining([
                expect.objectContaining({ id: expect.any(String), pageid: '728', name: expect.any(String), latestRevisionDate: expect.any(Date) }),
            ]),
            mockLoggerInstance
        );
    });
});

