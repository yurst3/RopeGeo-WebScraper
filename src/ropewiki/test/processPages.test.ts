import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Pool } from 'pg';
import processPages from '../processPages';
import getRopewikiPageHtml from '../http/getRopewikiPageHtml';
import parseRopewikiPage from '../parsers/parseRopewikiPage';
import upsertPage from '../database/upsertPage';
import upsertBetaSections from '../database/upsertBetaSections';
import upsertImages from '../database/upsertImages';
import setBetaSectionsDeletedAt from '../database/setBetaSectionsDeletedAt';
import setImagesDeletedAt from '../database/setImagesDeletedAt';
import RopewikiPageInfo from '../types/ropewiki';
import ProgressLogger from '../../helpers/progressLogger';
import * as db from 'zapatos/db';

// Mock the dependencies
jest.mock('../http/getRopewikiPageHtml');
jest.mock('../parsers/parseRopewikiPage');
jest.mock('../database/upsertPage');
jest.mock('../database/upsertBetaSections');
jest.mock('../database/upsertImages');
jest.mock('../database/setBetaSectionsDeletedAt');
jest.mock('../database/setImagesDeletedAt');

const mockGetRopewikiPageHtml = getRopewikiPageHtml as jest.MockedFunction<typeof getRopewikiPageHtml>;
const mockParseRopewikiPage = parseRopewikiPage as jest.MockedFunction<typeof parseRopewikiPage>;
const mockUpsertPage = upsertPage as jest.MockedFunction<typeof upsertPage>;
const mockUpsertBetaSections = upsertBetaSections as jest.MockedFunction<typeof upsertBetaSections>;
const mockUpsertImages = upsertImages as jest.MockedFunction<typeof upsertImages>;
const mockSetBetaSectionsDeletedAt = setBetaSectionsDeletedAt as jest.MockedFunction<typeof setBetaSectionsDeletedAt>;
const mockSetImagesDeletedAt = setImagesDeletedAt as jest.MockedFunction<typeof setImagesDeletedAt>;

describe('processPages', () => {
    let mockPool: Pool;
    let mockClient: {
        query: jest.MockedFunction<(query: string) => Promise<unknown>>;
        release: jest.MockedFunction<() => void>;
    };
    let mockLogger: {
        logProgress: jest.MockedFunction<(message: string) => void>;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        // Create mock client with query and release methods
        mockClient = {
            query: jest.fn<typeof mockClient.query>().mockResolvedValue({}),
            release: jest.fn<typeof mockClient.release>(),
        };
        // Create mock pool with connect method
        mockPool = {
            connect: jest.fn<() => Promise<typeof mockClient>>().mockResolvedValue(mockClient),
        } as unknown as Pool;

        // Create mock logger
        mockLogger = {
            logProgress: jest.fn(),
        };
    });

    it('processes pages successfully', async () => {
        const page1 = new RopewikiPageInfo({
            printouts: {
                pageid: ['728'],
                name: ['Bear Creek Canyon'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Bear_Creek_Canyon'],
                latestRevisionDate: [{ timestamp: '1609459200', raw: '1/2021/1/1/0/0/0/0' }],
            },
        });
        const page2 = new RopewikiPageInfo({
            printouts: {
                pageid: ['5597'],
                name: ['Regions'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Regions'],
                latestRevisionDate: [{ timestamp: '1609459200', raw: '1/2021/1/1/0/0/0/0' }],
            },
        });

        const pages = [page1, page2];
        const pageRevisionDates = {
            '728': new Date('2024-01-01T00:00:00Z'),
            '5597': new Date('2024-01-02T00:00:00Z'),
        };
        const regionNameIds = {
            'Test Region': 'region-id-123',
        };

        mockGetRopewikiPageHtml
            .mockResolvedValueOnce('<html>Page 1</html>')
            .mockResolvedValueOnce('<html>Page 2</html>');
        mockParseRopewikiPage
            .mockResolvedValueOnce({
                beta: [{ title: 'Introduction', text: 'Text 1', order: 1 }],
                images: [{ fileUrl: 'image1.jpg', linkUrl: 'link1', betaSectionTitle: undefined, caption: undefined, order: 1 }],
            })
            .mockResolvedValueOnce({
                beta: [{ title: 'Approach', text: 'Text 2', order: 1 }],
                images: [],
            });
        mockUpsertPage
            .mockResolvedValueOnce('page-uuid-1')
            .mockResolvedValueOnce('page-uuid-2');
        mockUpsertBetaSections
            .mockResolvedValueOnce({ 'Introduction': 'beta-id-1' })
            .mockResolvedValueOnce({ 'Approach': 'beta-id-2' });
        mockUpsertImages
            .mockResolvedValueOnce(['image-id-1'])
            .mockResolvedValueOnce([]);

        await processPages(mockPool, pages, pageRevisionDates, regionNameIds, mockLogger as unknown as ProgressLogger);

        expect(mockLogger.logProgress).toHaveBeenCalledTimes(2);
        expect(mockLogger.logProgress).toHaveBeenNthCalledWith(1, '728 Bear Creek Canyon');
        expect(mockLogger.logProgress).toHaveBeenNthCalledWith(2, '5597 Regions');

        expect(mockPool.connect).toHaveBeenCalledTimes(2);
        expect(mockClient.query).toHaveBeenCalledTimes(4); // BEGIN + COMMIT for each of 2 pages
        expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
        expect(mockClient.query).toHaveBeenNthCalledWith(2, 'COMMIT');
        expect(mockClient.query).toHaveBeenNthCalledWith(3, 'BEGIN');
        expect(mockClient.query).toHaveBeenNthCalledWith(4, 'COMMIT');
        expect(mockClient.release).toHaveBeenCalledTimes(2);

        expect(mockGetRopewikiPageHtml).toHaveBeenCalledTimes(2);
        expect(mockGetRopewikiPageHtml).toHaveBeenNthCalledWith(1, '728');
        expect(mockGetRopewikiPageHtml).toHaveBeenNthCalledWith(2, '5597');

        expect(mockUpsertPage).toHaveBeenCalledTimes(2);
        expect(mockUpsertPage).toHaveBeenNthCalledWith(1, mockClient as unknown as db.Queryable, page1, 'region-id-123', pageRevisionDates['728']);
        expect(mockUpsertPage).toHaveBeenNthCalledWith(2, mockClient as unknown as db.Queryable, page2, 'region-id-123', pageRevisionDates['5597']);

        expect(mockUpsertBetaSections).toHaveBeenCalledTimes(2);
        expect(mockUpsertImages).toHaveBeenCalledTimes(2);
        expect(mockSetBetaSectionsDeletedAt).toHaveBeenCalledTimes(2);
        expect(mockSetImagesDeletedAt).toHaveBeenCalledTimes(2);
    });

    it('skips pages with null or undefined latestRevisionDate', async () => {
        const page = new RopewikiPageInfo({
            printouts: {
                pageid: ['728'],
                name: ['Bear Creek Canyon'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Bear_Creek_Canyon'],
                latestRevisionDate: [{ timestamp: '1609459200', raw: '1/2021/1/1/0/0/0/0' }],
            },
        });

        const pages = [page];
        const pageRevisionDates: { [pageId: string]: Date | null } = {
            '728': null,
        };
        const regionNameIds = {
            'Test Region': 'region-id-123',
        };

        await processPages(mockPool, pages, pageRevisionDates, regionNameIds, mockLogger as unknown as ProgressLogger);

        expect(mockLogger.logProgress).toHaveBeenCalledTimes(1);
        expect(mockLogger.logProgress).toHaveBeenCalledWith('Skipped 728 Bear Creek Canyon (no revision date)');

        expect(mockPool.connect).not.toHaveBeenCalled();
        expect(mockGetRopewikiPageHtml).not.toHaveBeenCalled();
        expect(mockUpsertPage).not.toHaveBeenCalled();
    });

    it('skips pages with invalid region (no regionId)', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const page = new RopewikiPageInfo({
            printouts: {
                pageid: ['728'],
                name: ['Bear Creek Canyon'],
                region: [{ fulltext: 'Invalid Region' }],
                url: ['https://ropewiki.com/Bear_Creek_Canyon'],
                latestRevisionDate: [{ timestamp: '1609459200', raw: '1/2021/1/1/0/0/0/0' }],
            },
        });

        const pages = [page];
        const pageRevisionDates = {
            '728': new Date('2024-01-01T00:00:00Z'),
        };
        const regionNameIds = {
            'Test Region': 'region-id-123',
        };

        await processPages(mockPool, pages, pageRevisionDates, regionNameIds, mockLogger as unknown as ProgressLogger);

        expect(consoleErrorSpy).toHaveBeenCalledWith('728 Bear Creek Canyon doesn\'t have a valid region: Invalid Region');
        expect(mockLogger.logProgress).toHaveBeenCalledTimes(1);
        expect(mockLogger.logProgress).toHaveBeenCalledWith('Skipped 728 Bear Creek Canyon (invalid region)');
        expect(mockPool.connect).not.toHaveBeenCalled();
        expect(mockGetRopewikiPageHtml).not.toHaveBeenCalled();
        expect(mockUpsertPage).not.toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
    });

    it('sets deletedAt for beta sections and images not in updated lists', async () => {
        const page = new RopewikiPageInfo({
            printouts: {
                pageid: ['728'],
                name: ['Bear Creek Canyon'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Bear_Creek_Canyon'],
                latestRevisionDate: [{ timestamp: '1609459200', raw: '1/2021/1/1/0/0/0/0' }],
            },
        });

        const pages = [page];
        const pageRevisionDates = {
            '728': new Date('2024-01-01T00:00:00Z'),
        };
        const regionNameIds = {
            'Test Region': 'region-id-123',
        };

        mockGetRopewikiPageHtml.mockResolvedValue('<html>Page</html>');
        mockParseRopewikiPage.mockResolvedValue({
            beta: [{ title: 'Introduction', text: 'Text', order: 1 }],
            images: [{ fileUrl: 'image1.jpg', linkUrl: 'link1', betaSectionTitle: undefined, caption: undefined, order: 1 }],
        });
        mockUpsertPage.mockResolvedValue('page-uuid-1');
        mockUpsertBetaSections.mockResolvedValue({ 'Introduction': 'beta-id-1' });
        mockUpsertImages.mockResolvedValue(['image-id-1']);

        await processPages(mockPool, pages, pageRevisionDates, regionNameIds, mockLogger as unknown as ProgressLogger);

        expect(mockPool.connect).toHaveBeenCalledTimes(1);
        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
        expect(mockClient.release).toHaveBeenCalledTimes(1);
        expect(mockSetBetaSectionsDeletedAt).toHaveBeenCalledWith(mockClient as unknown as db.Queryable, 'page-uuid-1', ['beta-id-1']);
        expect(mockSetImagesDeletedAt).toHaveBeenCalledWith(mockClient as unknown as db.Queryable, 'page-uuid-1', ['image-id-1']);
    });

    it('propagates errors from getRopewikiPageHtml()', async () => {
        const page = new RopewikiPageInfo({
            printouts: {
                pageid: ['728'],
                name: ['Bear Creek Canyon'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Bear_Creek_Canyon'],
                latestRevisionDate: [{ timestamp: '1609459200', raw: '1/2021/1/1/0/0/0/0' }],
            },
        });

        const pages = [page];
        const pageRevisionDates = {
            '728': new Date('2024-01-01T00:00:00Z'),
        };
        const regionNameIds = {
            'Test Region': 'region-id-123',
        };

        const htmlError = new Error('Failed to fetch HTML');
        mockGetRopewikiPageHtml.mockRejectedValue(htmlError);

        await expect(processPages(mockPool, pages, pageRevisionDates, regionNameIds, mockLogger as unknown as ProgressLogger)).rejects.toThrow('Failed to fetch HTML');
        
        expect(mockPool.connect).not.toHaveBeenCalled();
    });

    it('propagates errors from upsertPage()', async () => {
        const page = new RopewikiPageInfo({
            printouts: {
                pageid: ['728'],
                name: ['Bear Creek Canyon'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Bear_Creek_Canyon'],
                latestRevisionDate: [{ timestamp: '1609459200', raw: '1/2021/1/1/0/0/0/0' }],
            },
        });

        const pages = [page];
        const pageRevisionDates = {
            '728': new Date('2024-01-01T00:00:00Z'),
        };
        const regionNameIds = {
            'Test Region': 'region-id-123',
        };

        mockGetRopewikiPageHtml.mockResolvedValue('<html>Page</html>');
        const dbError = new Error('Database error');
        mockUpsertPage.mockRejectedValue(dbError);

        await expect(processPages(mockPool, pages, pageRevisionDates, regionNameIds, mockLogger as unknown as ProgressLogger)).rejects.toThrow('Database error');
        
        expect(mockPool.connect).toHaveBeenCalledTimes(1);
        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
        expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('propagates errors from parseRopewikiPage()', async () => {
        const page = new RopewikiPageInfo({
            printouts: {
                pageid: ['728'],
                name: ['Bear Creek Canyon'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Bear_Creek_Canyon'],
                latestRevisionDate: [{ timestamp: '1609459200', raw: '1/2021/1/1/0/0/0/0' }],
            },
        });

        const pages = [page];
        const pageRevisionDates = {
            '728': new Date('2024-01-01T00:00:00Z'),
        };
        const regionNameIds = {
            'Test Region': 'region-id-123',
        };

        mockGetRopewikiPageHtml.mockResolvedValue('<html>Page</html>');
        mockUpsertPage.mockResolvedValue('page-uuid-1');
        const parseError = new Error('Parse error');
        mockParseRopewikiPage.mockRejectedValue(parseError);

        await expect(processPages(mockPool, pages, pageRevisionDates, regionNameIds, mockLogger as unknown as ProgressLogger)).rejects.toThrow('Parse error');
        
        expect(mockPool.connect).not.toHaveBeenCalled();
    });

    it('propagates errors from upsertBetaSections()', async () => {
        const page = new RopewikiPageInfo({
            printouts: {
                pageid: ['728'],
                name: ['Bear Creek Canyon'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Bear_Creek_Canyon'],
                latestRevisionDate: [{ timestamp: '1609459200', raw: '1/2021/1/1/0/0/0/0' }],
            },
        });

        const pages = [page];
        const pageRevisionDates = {
            '728': new Date('2024-01-01T00:00:00Z'),
        };
        const regionNameIds = {
            'Test Region': 'region-id-123',
        };

        mockGetRopewikiPageHtml.mockResolvedValue('<html>Page</html>');
        mockUpsertPage.mockResolvedValue('page-uuid-1');
        mockParseRopewikiPage.mockResolvedValue({
            beta: [{ title: 'Introduction', text: 'Text', order: 1 }],
            images: [],
        });
        const betaError = new Error('Beta sections error');
        mockUpsertBetaSections.mockRejectedValue(betaError);

        await expect(processPages(mockPool, pages, pageRevisionDates, regionNameIds, mockLogger as unknown as ProgressLogger)).rejects.toThrow('Beta sections error');
        
        expect(mockPool.connect).toHaveBeenCalledTimes(1);
        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
        expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('propagates errors from upsertImages()', async () => {
        const page = new RopewikiPageInfo({
            printouts: {
                pageid: ['728'],
                name: ['Bear Creek Canyon'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Bear_Creek_Canyon'],
                latestRevisionDate: [{ timestamp: '1609459200', raw: '1/2021/1/1/0/0/0/0' }],
            },
        });

        const pages = [page];
        const pageRevisionDates = {
            '728': new Date('2024-01-01T00:00:00Z'),
        };
        const regionNameIds = {
            'Test Region': 'region-id-123',
        };

        mockGetRopewikiPageHtml.mockResolvedValue('<html>Page</html>');
        mockUpsertPage.mockResolvedValue('page-uuid-1');
        mockParseRopewikiPage.mockResolvedValue({
            beta: [{ title: 'Introduction', text: 'Text', order: 1 }],
            images: [{ fileUrl: 'image1.jpg', linkUrl: 'link1', betaSectionTitle: undefined, caption: undefined, order: 1 }],
        });
        mockUpsertBetaSections.mockResolvedValue({ 'Introduction': 'beta-id-1' });
        const imagesError = new Error('Images error');
        mockUpsertImages.mockRejectedValue(imagesError);

        await expect(processPages(mockPool, pages, pageRevisionDates, regionNameIds, mockLogger as unknown as ProgressLogger)).rejects.toThrow('Images error');
        
        expect(mockPool.connect).toHaveBeenCalledTimes(1);
        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
        expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('propagates errors from setBetaSectionsDeletedAt()', async () => {
        const page = new RopewikiPageInfo({
            printouts: {
                pageid: ['728'],
                name: ['Bear Creek Canyon'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Bear_Creek_Canyon'],
                latestRevisionDate: [{ timestamp: '1609459200', raw: '1/2021/1/1/0/0/0/0' }],
            },
        });

        const pages = [page];
        const pageRevisionDates = {
            '728': new Date('2024-01-01T00:00:00Z'),
        };
        const regionNameIds = {
            'Test Region': 'region-id-123',
        };

        mockGetRopewikiPageHtml.mockResolvedValue('<html>Page</html>');
        mockUpsertPage.mockResolvedValue('page-uuid-1');
        mockParseRopewikiPage.mockResolvedValue({
            beta: [{ title: 'Introduction', text: 'Text', order: 1 }],
            images: [],
        });
        mockUpsertBetaSections.mockResolvedValue({ 'Introduction': 'beta-id-1' });
        mockUpsertImages.mockResolvedValue([]);
        const deleteError = new Error('Delete beta sections error');
        mockSetBetaSectionsDeletedAt.mockRejectedValue(deleteError);

        await expect(processPages(mockPool, pages, pageRevisionDates, regionNameIds, mockLogger as unknown as ProgressLogger)).rejects.toThrow('Delete beta sections error');
        
        expect(mockPool.connect).toHaveBeenCalledTimes(1);
        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
        expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('propagates errors from setImagesDeletedAt()', async () => {
        const page = new RopewikiPageInfo({
            printouts: {
                pageid: ['728'],
                name: ['Bear Creek Canyon'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Bear_Creek_Canyon'],
                latestRevisionDate: [{ timestamp: '1609459200', raw: '1/2021/1/1/0/0/0/0' }],
            },
        });

        const pages = [page];
        const pageRevisionDates = {
            '728': new Date('2024-01-01T00:00:00Z'),
        };
        const regionNameIds = {
            'Test Region': 'region-id-123',
        };

        mockGetRopewikiPageHtml.mockResolvedValue('<html>Page</html>');
        mockUpsertPage.mockResolvedValue('page-uuid-1');
        mockParseRopewikiPage.mockResolvedValue({
            beta: [{ title: 'Introduction', text: 'Text', order: 1 }],
            images: [{ fileUrl: 'image1.jpg', linkUrl: 'link1', betaSectionTitle: undefined, caption: undefined, order: 1 }],
        });
        mockUpsertBetaSections.mockResolvedValue({ 'Introduction': 'beta-id-1' });
        mockUpsertImages.mockResolvedValue(['image-id-1']);
        mockSetBetaSectionsDeletedAt.mockResolvedValue();
        const deleteError = new Error('Delete images error');
        mockSetImagesDeletedAt.mockRejectedValue(deleteError);

        await expect(processPages(mockPool, pages, pageRevisionDates, regionNameIds, mockLogger as unknown as ProgressLogger)).rejects.toThrow('Delete images error');
        
        expect(mockPool.connect).toHaveBeenCalledTimes(1);
        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
        expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('logs error and rolls back transaction on database error', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const page = new RopewikiPageInfo({
            printouts: {
                pageid: ['728'],
                name: ['Bear Creek Canyon'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Bear_Creek_Canyon'],
                latestRevisionDate: [{ timestamp: '1609459200', raw: '1/2021/1/1/0/0/0/0' }],
            },
        });

        const pages = [page];
        const pageRevisionDates = {
            '728': new Date('2024-01-01T00:00:00Z'),
        };
        const regionNameIds = {
            'Test Region': 'region-id-123',
        };

        mockGetRopewikiPageHtml.mockResolvedValue('<html>Page</html>');
        mockParseRopewikiPage.mockResolvedValue({
            beta: [{ title: 'Introduction', text: 'Text', order: 1 }],
            images: [],
        });
        const dbError = new Error('Database error');
        mockUpsertPage.mockRejectedValue(dbError);

        await expect(processPages(mockPool, pages, pageRevisionDates, regionNameIds, mockLogger as unknown as ProgressLogger)).rejects.toThrow('Database error');

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error processing page 728 Bear Creek Canyon, transaction rolled back:', dbError);
        expect(mockPool.connect).toHaveBeenCalledTimes(1);
        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
        expect(mockClient.release).toHaveBeenCalledTimes(1);

        consoleErrorSpy.mockRestore();
    });
});

