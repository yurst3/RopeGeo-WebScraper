import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Pool } from 'pg';
import * as db from 'zapatos/db';
import handleRopewikiPages from '../handleRopewikiPages';
import RopewikiPageInfo from '../types/ropewiki';

// Mock all dependencies
jest.mock('../http/getRopewikiPageInfoForRegion');
jest.mock('../database/getUpdatedDatesForPages');
jest.mock('../database/upsertPages');
jest.mock('../parsePages');
jest.mock('../../helpers/progressLogger');

import getRopewikiPageInfoForRegion from '../http/getRopewikiPageInfoForRegion';
import getUpdatedDatesForPages from '../database/getUpdatedDatesForPages';
import upsertPages from '../database/upsertPages';
import parsePages from '../parsePages';
import ProgressLogger from '../../helpers/progressLogger';

const mockGetRopewikiPageInfoForRegion = getRopewikiPageInfoForRegion as jest.MockedFunction<typeof getRopewikiPageInfoForRegion>;
const mockGetUpdatedDatesForPages = getUpdatedDatesForPages as jest.MockedFunction<typeof getUpdatedDatesForPages>;
const mockUpsertPages = upsertPages as jest.MockedFunction<typeof upsertPages>;
const mockParsePages = parsePages as jest.MockedFunction<typeof parsePages>;
const MockProgressLogger = ProgressLogger as jest.MockedClass<typeof ProgressLogger>;

describe('handleRopewikiPages', () => {
    let mockPool: Pool;
    let mockClient: {
        query: jest.MockedFunction<(query: string) => Promise<unknown>>;
        release: jest.MockedFunction<() => void>;
    };
    let consoleLogSpy: ReturnType<typeof jest.spyOn>;
    let consoleErrorSpy: ReturnType<typeof jest.spyOn>;
    let mockLoggerInstance: {
        setChunk: jest.MockedFunction<(start: number, end: number) => void>;
        logProgress: jest.MockedFunction<(message: string) => void>;
    };

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        MockProgressLogger.mockImplementation(() => mockLoggerInstance as any);
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    const createValidPage = (pageid: string, name: string, region: string, regionNameIds: {[name: string]: string}, revisionDate?: Date): RopewikiPageInfo => {
        const date = revisionDate || new Date('2024-01-01T00:00:00Z');
        const timestamp = Math.floor(date.getTime() / 1000).toString();
        return new RopewikiPageInfo({
            printouts: {
                pageid: [pageid],
                name: [name],
                region: [{ fulltext: region }],
                url: [`https://ropewiki.com/${name.replace(/\s+/g, '_')}`],
                latestRevisionDate: [{ timestamp, raw: '1/2021/1/1/0/0/0/0' }],
            },
        }, regionNameIds);
    };

    const createInvalidPage = (pageid: string, regionNameIds: {[name: string]: string}): RopewikiPageInfo => {
        return new RopewikiPageInfo({
            printouts: {
                pageid: [pageid],
                name: [], // Missing name makes it invalid
                region: [],
                url: [],
                latestRevisionDate: [], // Missing latestRevisionDate also makes it invalid
            },
        }, regionNameIds);
    };

    it('processes pages when count is under 2000', async () => {
        const regionName = 'Test Region';
        const regionPageCount = 100;
        const regionNameIds = { 'Test Region': 'region-id-123' };

        const page1 = createValidPage('728', 'Page 1', regionName, regionNameIds, new Date('2024-01-01T00:00:00Z'));
        const page2 = createValidPage('5597', 'Page 2', regionName, regionNameIds, new Date('2024-01-02T00:00:00Z'));
        const pages = [page1, page2];

        mockGetRopewikiPageInfoForRegion.mockResolvedValue(pages);
        mockGetUpdatedDatesForPages.mockResolvedValue({
            '728': null,
            '5597': null,
        });
        mockUpsertPages.mockResolvedValueOnce([
            { id: 'page-uuid-1', pageId: '728', name: 'Page 1', latestRevisionDate: new Date('2024-01-01T00:00:00Z') },
            { id: 'page-uuid-2', pageId: '5597', name: 'Page 2', latestRevisionDate: new Date('2024-01-02T00:00:00Z') },
        ]);
        mockParsePages.mockResolvedValue(undefined);

        await handleRopewikiPages(mockPool, regionName, regionPageCount, regionNameIds);

        expect(mockGetRopewikiPageInfoForRegion).toHaveBeenCalledTimes(1);
        expect(mockGetRopewikiPageInfoForRegion).toHaveBeenCalledWith(regionName, 0, 2000, regionNameIds);
        // Verify getUpdatedDatesForPages is called before upsertPages (with valid page IDs from the fetched pages)
        expect(mockGetUpdatedDatesForPages).toHaveBeenCalledWith(mockPool, ['728', '5597']);
        expect(mockGetUpdatedDatesForPages).toHaveBeenCalledTimes(1);
        expect(mockUpsertPages).toHaveBeenCalledTimes(1);
        // Verify call order: getUpdatedDatesForPages should be called before upsertPages
        expect(mockGetUpdatedDatesForPages.mock.invocationCallOrder[0]).toBeLessThan(mockUpsertPages.mock.invocationCallOrder[0]!);
        expect(mockParsePages).toHaveBeenCalledTimes(1);
        expect(MockProgressLogger).toHaveBeenCalledWith(`Processing "${regionName}"`, regionPageCount);
        expect(mockLoggerInstance.setChunk).toHaveBeenCalledWith(0, 1); // offset=0, skippedInChunk=0, chunkEnd=0+2-1=1
        expect(mockParsePages).toHaveBeenCalledWith(
            mockClient as unknown as db.Queryable,
            expect.arrayContaining([
                expect.objectContaining({ id: expect.any(String), pageId: '728', name: 'Page 1', latestRevisionDate: expect.any(Date) }),
                expect.objectContaining({ id: expect.any(String), pageId: '5597', name: 'Page 2', latestRevisionDate: expect.any(Date) }),
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

        mockGetRopewikiPageInfoForRegion
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

        mockUpsertPages.mockImplementation((_, pages: RopewikiPageInfo[]) => 
            Promise.resolve(pages.map(pageInfo => ({
                id: `uuid-${pageInfo.pageid}`,
                pageId: pageInfo.pageid,
                name: pageInfo.name,
                latestRevisionDate: pageInfo.latestRevisionDate,
            })))
        );
        mockParsePages.mockResolvedValue(undefined);

        await handleRopewikiPages(mockPool, regionName, regionPageCount, regionNameIds);

        expect(mockGetRopewikiPageInfoForRegion).toHaveBeenCalledTimes(2);
        expect(mockGetRopewikiPageInfoForRegion).toHaveBeenNthCalledWith(1, regionName, 0, 2000, regionNameIds);
        expect(mockGetRopewikiPageInfoForRegion).toHaveBeenNthCalledWith(2, regionName, 2000, 2000, regionNameIds);
        expect(mockGetUpdatedDatesForPages).toHaveBeenCalledTimes(2);
        // Verify getUpdatedDatesForPages is called before upsertPages for each chunk
        expect(mockGetUpdatedDatesForPages.mock.invocationCallOrder[0]).toBeLessThan(mockUpsertPages.mock.invocationCallOrder[0]!);
        expect(mockGetUpdatedDatesForPages.mock.invocationCallOrder[1]).toBeLessThan(mockUpsertPages.mock.invocationCallOrder[1]!);
        expect(mockParsePages).toHaveBeenCalledTimes(2);
        expect(MockProgressLogger).toHaveBeenCalledWith(`Processing "${regionName}"`, regionPageCount);
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

        mockGetRopewikiPageInfoForRegion.mockResolvedValue(pages);
        mockGetUpdatedDatesForPages.mockResolvedValue({
            '728': null,
        });
        mockUpsertPages.mockResolvedValueOnce([
            { id: 'page-uuid-1', pageId: '728', name: 'Page 1', latestRevisionDate: new Date('2024-01-01T00:00:00Z') },
        ]);
        mockParsePages.mockResolvedValue(undefined);

        await handleRopewikiPages(mockPool, regionName, regionPageCount, regionNameIds);

        expect(consoleLogSpy).toHaveBeenCalledWith('Skipping 2 invalid pages...');
        // Verify getUpdatedDatesForPages is called before upsertPages, only with valid page IDs
        expect(mockGetUpdatedDatesForPages).toHaveBeenCalledWith(mockPool, ['728']);
        expect(mockGetUpdatedDatesForPages.mock.invocationCallOrder[0]).toBeLessThan(mockUpsertPages.mock.invocationCallOrder[0]!);
        expect(mockLoggerInstance.setChunk).toHaveBeenCalledWith(2, 2); // offset=0, skippedInChunk=2 (2 invalid), chunkEnd=0+2+1-1=2
        expect(mockParsePages).toHaveBeenCalledWith(
            mockClient as unknown as db.Queryable,
            expect.arrayContaining([
                expect.objectContaining({ id: expect.any(String), pageId: '728', name: expect.any(String), latestRevisionDate: expect.any(Date) }),
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

        mockGetRopewikiPageInfoForRegion.mockResolvedValue(pages);
        // getUpdatedDatesForPages is called BEFORE upsertPages
        mockGetUpdatedDatesForPages.mockResolvedValue({
            '728': new Date('2024-01-02T00:00:00Z'), // Updated after revision
            '5597': new Date('2024-01-03T00:00:00Z'), // Updated after revision
        });
        // upsertPages returns the upserted pages
        mockUpsertPages.mockResolvedValueOnce([
            { id: 'page-uuid-1', pageId: '728', name: 'Page 1', latestRevisionDate: new Date('2024-01-01T00:00:00Z') },
            { id: 'page-uuid-2', pageId: '5597', name: 'Page 2', latestRevisionDate: new Date('2024-01-02T00:00:00Z') },
        ]);
        mockParsePages.mockResolvedValue(undefined);

        await handleRopewikiPages(mockPool, regionName, regionPageCount, regionNameIds);

        // Verify getUpdatedDatesForPages is called before upsertPages (with valid page IDs from the fetched pages)
        expect(mockGetUpdatedDatesForPages).toHaveBeenCalledWith(mockPool, ['728', '5597']);
        expect(mockGetUpdatedDatesForPages).toHaveBeenCalledTimes(1);
        expect(mockUpsertPages).toHaveBeenCalledTimes(1);
        // Verify call order: getUpdatedDatesForPages should be called before upsertPages
        expect(mockGetUpdatedDatesForPages.mock.invocationCallOrder[0]).toBeLessThan(mockUpsertPages.mock.invocationCallOrder[0]!);
        expect(consoleLogSpy).toHaveBeenCalledWith('Skipping parsing for 2 pages...');
        expect(mockParsePages).not.toHaveBeenCalled();
    });

    it('processes pages where updatedDate is before revisionDate', async () => {
        const regionName = 'Test Region';
        const regionPageCount = 2;
        const regionNameIds = { 'Test Region': 'region-id-123' };

        const page1 = createValidPage('728', 'Page 1', regionName, regionNameIds, new Date('2024-01-03T00:00:00Z'));
        const page2 = createValidPage('5597', 'Page 2', regionName, regionNameIds, new Date('2024-01-04T00:00:00Z'));
        const pages = [page1, page2];

        mockGetRopewikiPageInfoForRegion.mockResolvedValue(pages);
        // getUpdatedDatesForPages is called BEFORE upsertPages
        mockGetUpdatedDatesForPages.mockResolvedValue({
            '728': new Date('2024-01-01T00:00:00Z'), // Updated before revision
            '5597': new Date('2024-01-02T00:00:00Z'), // Updated before revision
        });
        // upsertPages returns the upserted pages
        mockUpsertPages.mockResolvedValueOnce([
            { id: 'page-uuid-1', pageId: '728', name: 'Page 1', latestRevisionDate: new Date('2024-01-03T00:00:00Z') },
            { id: 'page-uuid-2', pageId: '5597', name: 'Page 2', latestRevisionDate: new Date('2024-01-04T00:00:00Z') },
        ]);
        mockParsePages.mockResolvedValue(undefined);

        await handleRopewikiPages(mockPool, regionName, regionPageCount, regionNameIds);

        // Verify getUpdatedDatesForPages is called before upsertPages (with valid page IDs from the fetched pages)
        expect(mockGetUpdatedDatesForPages).toHaveBeenCalledWith(mockPool, ['728', '5597']);
        expect(mockGetUpdatedDatesForPages).toHaveBeenCalledTimes(1);
        expect(mockUpsertPages).toHaveBeenCalledTimes(1);
        // Verify call order: getUpdatedDatesForPages should be called before upsertPages
        expect(mockGetUpdatedDatesForPages.mock.invocationCallOrder[0]).toBeLessThan(mockUpsertPages.mock.invocationCallOrder[0]!);
        expect(mockParsePages).toHaveBeenCalledTimes(1);
        expect(mockLoggerInstance.setChunk).toHaveBeenCalledWith(0, 1); // offset=0, skippedInChunk=0, chunkEnd=0+2-1=1
        expect(mockParsePages).toHaveBeenCalledWith(
            mockClient as unknown as db.Queryable,
            expect.arrayContaining([
                expect.objectContaining({ id: expect.any(String), pageId: '728', name: 'Page 1', latestRevisionDate: expect.any(Date) }),
                expect.objectContaining({ id: expect.any(String), pageId: '5597', name: 'Page 2', latestRevisionDate: expect.any(Date) }),
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

        mockGetRopewikiPageInfoForRegion.mockResolvedValue(pages);
        mockGetUpdatedDatesForPages.mockResolvedValue({
            '728': null, // No update date
        });
        mockUpsertPages.mockResolvedValueOnce([
            { id: 'page-uuid-1', pageId: '728', name: 'Page 1', latestRevisionDate: new Date('2024-01-01T00:00:00Z') },
        ]);
        mockParsePages.mockResolvedValue(undefined);

        await handleRopewikiPages(mockPool, regionName, regionPageCount, regionNameIds);

        // Verify getUpdatedDatesForPages is called before upsertPages
        expect(mockGetUpdatedDatesForPages.mock.invocationCallOrder[0]).toBeLessThan(mockUpsertPages.mock.invocationCallOrder[0]!);
        expect(mockParsePages).toHaveBeenCalledTimes(1);
        expect(mockLoggerInstance.setChunk).toHaveBeenCalledWith(0, 0); // offset=0, skippedInChunk=0, chunkEnd=0+1-1=0
        expect(mockParsePages).toHaveBeenCalledWith(
            mockClient as unknown as db.Queryable,
            expect.arrayContaining([
                expect.objectContaining({ id: expect.any(String), pageId: '728', name: expect.any(String), latestRevisionDate: expect.any(Date) }),
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

        mockGetRopewikiPageInfoForRegion.mockResolvedValue(pages);
        // getUpdatedDatesForPages is called BEFORE upsertPages, only for valid pages (page1 is invalid)
        mockGetUpdatedDatesForPages.mockResolvedValue({
            '5597': null,
        });
        mockUpsertPages.mockResolvedValueOnce([
            { id: 'page-uuid-2', pageId: '5597', name: 'Page 2', latestRevisionDate: new Date('2024-01-01T00:00:00Z') },
        ]);
        mockParsePages.mockResolvedValue(undefined);

        await handleRopewikiPages(mockPool, regionName, regionPageCount, regionNameIds);

        // Verify getUpdatedDatesForPages is called before upsertPages, only with valid page IDs
        expect(mockGetUpdatedDatesForPages).toHaveBeenCalledWith(mockPool, ['5597']);
        expect(mockGetUpdatedDatesForPages.mock.invocationCallOrder[0]).toBeLessThan(mockUpsertPages.mock.invocationCallOrder[0]!);
        expect(mockParsePages).toHaveBeenCalledTimes(1);
        expect(mockLoggerInstance.setChunk).toHaveBeenCalledWith(1, 1); // offset=0, skippedInChunk=1 (page1 is invalid), chunkEnd=0+1+1-1=1
        expect(mockParsePages).toHaveBeenCalledWith(
            mockClient as unknown as db.Queryable,
            expect.arrayContaining([
                expect.objectContaining({ id: expect.any(String), pageId: '5597', name: expect.any(String), latestRevisionDate: expect.any(Date) }),
            ]),
            mockLoggerInstance
        );
    });

    it('propagates errors from getRopewikiPageInfoForRegion()', async () => {
        const regionName = 'Test Region';
        const regionPageCount = 100;
        const regionNameIds = { 'Test Region': 'region-id-123' };

        const error = new Error('API error');
        mockGetRopewikiPageInfoForRegion.mockRejectedValue(error);

        await expect(handleRopewikiPages(mockPool, regionName, regionPageCount, regionNameIds)).rejects.toThrow('API error');
    });

    it('propagates errors from getUpdatedDatesForPages()', async () => {
        const regionName = 'Test Region';
        const regionPageCount = 1;
        const regionNameIds = { 'Test Region': 'region-id-123' };

        const page = createValidPage('728', 'Page 1', regionName, regionNameIds, new Date('2024-01-01T00:00:00Z'));
        mockGetRopewikiPageInfoForRegion.mockResolvedValue([page]);

        const error = new Error('Database error');
        mockGetUpdatedDatesForPages.mockRejectedValue(error);

        await expect(handleRopewikiPages(mockPool, regionName, regionPageCount, regionNameIds)).rejects.toThrow('Database error');
    });

    it('propagates errors from parsePages()', async () => {
        const regionName = 'Test Region';
        const regionPageCount = 1;
        const regionNameIds = { 'Test Region': 'region-id-123' };

        const page = createValidPage('728', 'Page 1', regionName, regionNameIds, new Date('2024-01-01T00:00:00Z'));
        mockGetRopewikiPageInfoForRegion.mockResolvedValue([page]);
        mockGetUpdatedDatesForPages.mockResolvedValue({
            '728': null,
        });
        mockUpsertPages.mockResolvedValueOnce([
            { id: 'page-uuid-1', pageId: '728', name: 'Page 1', latestRevisionDate: new Date('2024-01-01T00:00:00Z') },
        ]);

        const error = new Error('Process pages error');
        mockParsePages.mockRejectedValue(error);

        await expect(handleRopewikiPages(mockPool, regionName, regionPageCount, regionNameIds)).rejects.toThrow('Process pages error');
    });

    it('does not call parsePages when no pages need processing', async () => {
        const regionName = 'Test Region';
        const regionPageCount = 1;
        const regionNameIds = { 'Test Region': 'region-id-123' };

        const page = createInvalidPage('728', regionNameIds); // Invalid page has no revision date, so page will be filtered out
        mockGetRopewikiPageInfoForRegion.mockResolvedValue([page]);
        mockGetUpdatedDatesForPages.mockResolvedValue({
            '728': null,
        });

        await handleRopewikiPages(mockPool, regionName, regionPageCount, regionNameIds);

        expect(mockParsePages).not.toHaveBeenCalled();
    });

    it('handles mixed scenarios with some pages processed and some skipped', async () => {
        const regionName = 'Test Region';
        const regionPageCount = 3;
        const regionNameIds = { 'Test Region': 'region-id-123' };

        const page1 = createValidPage('728', 'Page 1', regionName, regionNameIds, new Date('2024-01-03T00:00:00Z'));
        const page2 = createValidPage('5597', 'Page 2', regionName, regionNameIds, new Date('2024-01-02T00:00:00Z'));
        const page3 = createInvalidPage('9999', regionNameIds); // Invalid page has no revision date
        const pages = [page1, page2, page3];

        mockGetRopewikiPageInfoForRegion.mockResolvedValue(pages);
        // getUpdatedDatesForPages is called BEFORE upsertPages, only for valid pages
        mockGetUpdatedDatesForPages.mockResolvedValue({
            '728': new Date('2024-01-01T00:00:00Z'), // Updated before revision - should process
            '5597': new Date('2024-01-03T00:00:00Z'), // Updated after revision - should skip
        });
        // upsertPages returns all valid pages (page3 is invalid, so not included)
        mockUpsertPages.mockResolvedValueOnce([
            { id: 'page-uuid-1', pageId: '728', name: 'Page 1', latestRevisionDate: new Date('2024-01-03T00:00:00Z') },
            { id: 'page-uuid-2', pageId: '5597', name: 'Page 2', latestRevisionDate: new Date('2024-01-02T00:00:00Z') },
        ]);
        mockParsePages.mockResolvedValue(undefined);

        await handleRopewikiPages(mockPool, regionName, regionPageCount, regionNameIds);

        // Verify getUpdatedDatesForPages is called before upsertPages, only with valid page IDs
        expect(mockGetUpdatedDatesForPages).toHaveBeenCalledWith(mockPool, ['728', '5597']);
        expect(mockGetUpdatedDatesForPages.mock.invocationCallOrder[0]).toBeLessThan(mockUpsertPages.mock.invocationCallOrder[0]!);
        expect(consoleLogSpy).toHaveBeenCalledWith('Skipping parsing for 1 pages...');
        expect(mockParsePages).toHaveBeenCalledTimes(1);
        expect(mockLoggerInstance.setChunk).toHaveBeenCalledWith(2, 2); // offset=0, skippedInChunk=2 (page2 updated after revision, page3 invalid), chunkEnd=0+2+1-1=2
        expect(mockParsePages).toHaveBeenCalledWith(
            mockClient as unknown as db.Queryable,
            expect.arrayContaining([
                expect.objectContaining({ id: expect.any(String), pageId: '728', name: expect.any(String), latestRevisionDate: expect.any(Date) }),
            ]),
            mockLoggerInstance
        );
    });
});

