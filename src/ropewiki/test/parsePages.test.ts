import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Pool } from 'pg';
import parsePages from '../parsePages';
import getRopewikiPageHtml from '../http/getRopewikiPageHtml';
import parseRopewikiPage from '../parsers/parseRopewikiPage';
import upsertBetaSections from '../database/upsertBetaSections';
import upsertImages from '../database/upsertImages';
import setBetaSectionsDeletedAt from '../database/setBetaSectionsDeletedAt';
import setImagesDeletedAt from '../database/setImagesDeletedAt';
import ProgressLogger from '../../helpers/progressLogger';
import * as db from 'zapatos/db';

// Mock the dependencies
jest.mock('../http/getRopewikiPageHtml');
jest.mock('../parsers/parseRopewikiPage');
jest.mock('../database/upsertBetaSections');
jest.mock('../database/upsertImages');
jest.mock('../database/setBetaSectionsDeletedAt');
jest.mock('../database/setImagesDeletedAt');

const mockGetRopewikiPageHtml = getRopewikiPageHtml as jest.MockedFunction<typeof getRopewikiPageHtml>;
const mockParseRopewikiPage = parseRopewikiPage as jest.MockedFunction<typeof parseRopewikiPage>;
const mockUpsertBetaSections = upsertBetaSections as jest.MockedFunction<typeof upsertBetaSections>;
const mockUpsertImages = upsertImages as jest.MockedFunction<typeof upsertImages>;
const mockSetBetaSectionsDeletedAt = setBetaSectionsDeletedAt as jest.MockedFunction<typeof setBetaSectionsDeletedAt>;
const mockSetImagesDeletedAt = setImagesDeletedAt as jest.MockedFunction<typeof setImagesDeletedAt>;

describe('parsePages', () => {
    let mockClient: {
        query: jest.MockedFunction<(query: string) => Promise<unknown>>;
    };
    let mockLogger: {
        logProgress: jest.MockedFunction<(message: string) => void>;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        // Create mock client (already in a transaction from handleRopewikiPages)
        mockClient = {
            query: jest.fn<typeof mockClient.query>().mockResolvedValue({}),
        };

        // Create mock logger
        mockLogger = {
            logProgress: jest.fn(),
        };
    });

    it('processes pages successfully', async () => {
        const page1RevisionDate = new Date('2024-01-01T00:00:00Z');
        const page2RevisionDate = new Date('2024-01-02T00:00:00Z');
        
        const pages = [
            { id: 'page-uuid-1', pageId: '728', name: 'Bear Creek Canyon', latestRevisionDate: page1RevisionDate },
            { id: 'page-uuid-2', pageId: '5597', name: 'Regions', latestRevisionDate: page2RevisionDate },
        ];

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
        mockUpsertBetaSections
            .mockResolvedValueOnce({ 'Introduction': 'beta-id-1' })
            .mockResolvedValueOnce({ 'Approach': 'beta-id-2' });
        mockUpsertImages
            .mockResolvedValueOnce(['image-id-1'])
            .mockResolvedValueOnce([]);

        await parsePages(mockClient as unknown as db.Queryable, pages, mockLogger as unknown as ProgressLogger);

        expect(mockLogger.logProgress).toHaveBeenCalledTimes(2);
        expect(mockLogger.logProgress).toHaveBeenNthCalledWith(1, '728 Bear Creek Canyon');
        expect(mockLogger.logProgress).toHaveBeenNthCalledWith(2, '5597 Regions');

        // Should use savepoints instead of BEGIN/COMMIT
        expect(mockClient.query).toHaveBeenCalledTimes(4); // SAVEPOINT + RELEASE for each of 2 pages
        expect(mockClient.query).toHaveBeenNthCalledWith(1, 'SAVEPOINT sp_page_0');
        expect(mockClient.query).toHaveBeenNthCalledWith(2, 'RELEASE SAVEPOINT sp_page_0');
        expect(mockClient.query).toHaveBeenNthCalledWith(3, 'SAVEPOINT sp_page_1');
        expect(mockClient.query).toHaveBeenNthCalledWith(4, 'RELEASE SAVEPOINT sp_page_1');

        expect(mockGetRopewikiPageHtml).toHaveBeenCalledTimes(2);
        expect(mockGetRopewikiPageHtml).toHaveBeenNthCalledWith(1, '728');
        expect(mockGetRopewikiPageHtml).toHaveBeenNthCalledWith(2, '5597');

        expect(mockUpsertBetaSections).toHaveBeenCalledTimes(2);
        expect(mockUpsertBetaSections).toHaveBeenNthCalledWith(1, mockClient as unknown as db.Queryable, 'page-uuid-1', [{ title: 'Introduction', text: 'Text 1', order: 1 }], page1RevisionDate);
        expect(mockUpsertBetaSections).toHaveBeenNthCalledWith(2, mockClient as unknown as db.Queryable, 'page-uuid-2', [{ title: 'Approach', text: 'Text 2', order: 1 }], page2RevisionDate);
        expect(mockUpsertImages).toHaveBeenCalledTimes(2);
        expect(mockSetBetaSectionsDeletedAt).toHaveBeenCalledTimes(2);
        expect(mockSetImagesDeletedAt).toHaveBeenCalledTimes(2);
    });


    it('sets deletedAt for beta sections and images not in updated lists', async () => {
        const revisionDate = new Date('2024-01-01T00:00:00Z');
        const pages = [
            { id: 'page-uuid-1', pageId: '728', name: 'Test Page', latestRevisionDate: revisionDate },
        ];

        mockGetRopewikiPageHtml.mockResolvedValue('<html>Page</html>');
        mockParseRopewikiPage.mockResolvedValue({
            beta: [{ title: 'Introduction', text: 'Text', order: 1 }],
            images: [{ fileUrl: 'image1.jpg', linkUrl: 'link1', betaSectionTitle: undefined, caption: undefined, order: 1 }],
        });
        mockUpsertBetaSections.mockResolvedValue({ 'Introduction': 'beta-id-1' });
        mockUpsertImages.mockResolvedValue(['image-id-1']);

        await parsePages(mockClient as unknown as db.Queryable, pages, mockLogger as unknown as ProgressLogger);

        // Should use savepoints instead of BEGIN/COMMIT
        expect(mockClient.query).toHaveBeenCalledWith('SAVEPOINT sp_page_0');
        expect(mockClient.query).toHaveBeenCalledWith('RELEASE SAVEPOINT sp_page_0');
        expect(mockSetBetaSectionsDeletedAt).toHaveBeenCalledWith(mockClient as unknown as db.Queryable, 'page-uuid-1', ['beta-id-1']);
        expect(mockSetImagesDeletedAt).toHaveBeenCalledWith(mockClient as unknown as db.Queryable, 'page-uuid-1', ['image-id-1']);
    });


    it('propagates errors from getRopewikiPageHtml()', async () => {
        const revisionDate = new Date('2024-01-01T00:00:00Z');
        const pages = [
            { id: 'page-uuid-1', pageId: '728', name: 'Test Page', latestRevisionDate: revisionDate },
        ];

        const htmlError = new Error('Failed to fetch HTML');
        mockGetRopewikiPageHtml.mockRejectedValue(htmlError);

        // HTTP errors are caught and logged, function continues (doesn't throw)
        await parsePages(mockClient as unknown as db.Queryable, pages, mockLogger as unknown as ProgressLogger);
        
        expect(mockLogger.logProgress).not.toHaveBeenCalled();
        expect(mockClient.query).not.toHaveBeenCalled();
    });

    it('propagates errors from parseRopewikiPage()', async () => {
        const revisionDate = new Date('2024-01-01T00:00:00Z');
        const pages = [
            { id: 'page-uuid-1', pageId: '728', name: 'Test Page', latestRevisionDate: revisionDate },
        ];

        mockGetRopewikiPageHtml.mockResolvedValue('<html>Page</html>');
        const parseError = new Error('Parse error');
        mockParseRopewikiPage.mockRejectedValue(parseError);

        // Parsing errors are caught and logged, function continues (doesn't throw)
        await parsePages(mockClient as unknown as db.Queryable, pages, mockLogger as unknown as ProgressLogger);
        
        expect(mockLogger.logProgress).not.toHaveBeenCalled();
        expect(mockClient.query).not.toHaveBeenCalled();
    });

    it('propagates errors from upsertBetaSections()', async () => {
        const revisionDate = new Date('2024-01-01T00:00:00Z');
        const pages = [
            { id: 'page-uuid-1', pageId: '728', name: 'Test Page', latestRevisionDate: revisionDate },
        ];

        mockGetRopewikiPageHtml.mockResolvedValue('<html>Page</html>');
        mockParseRopewikiPage.mockResolvedValue({
            beta: [{ title: 'Introduction', text: 'Text', order: 1 }],
            images: [],
        });
        const betaError = new Error('Beta sections error');
        mockUpsertBetaSections.mockRejectedValue(betaError);

        // Database errors are caught, rolled back to savepoint, and function continues
        await parsePages(mockClient as unknown as db.Queryable, pages, mockLogger as unknown as ProgressLogger);
        
        expect(mockClient.query).toHaveBeenCalledWith('SAVEPOINT sp_page_0');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT sp_page_0');
        expect(mockLogger.logProgress).not.toHaveBeenCalled();
    });

    it('propagates errors from upsertImages()', async () => {
        const revisionDate = new Date('2024-01-01T00:00:00Z');
        const pages = [
            { id: 'page-uuid-1', pageId: '728', name: 'Test Page', latestRevisionDate: revisionDate },
        ];

        mockGetRopewikiPageHtml.mockResolvedValue('<html>Page</html>');
        mockParseRopewikiPage.mockResolvedValue({
            beta: [{ title: 'Introduction', text: 'Text', order: 1 }],
            images: [{ fileUrl: 'image1.jpg', linkUrl: 'link1', betaSectionTitle: undefined, caption: undefined, order: 1 }],
        });
        mockUpsertBetaSections.mockResolvedValue({ 'Introduction': 'beta-id-1' });
        const imagesError = new Error('Images error');
        mockUpsertImages.mockRejectedValue(imagesError);

        // Database errors are caught, rolled back to savepoint, and function continues
        await parsePages(mockClient as unknown as db.Queryable, pages, mockLogger as unknown as ProgressLogger);
        
        expect(mockClient.query).toHaveBeenCalledWith('SAVEPOINT sp_page_0');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT sp_page_0');
        expect(mockLogger.logProgress).not.toHaveBeenCalled();
    });

    it('propagates errors from setBetaSectionsDeletedAt()', async () => {
        const revisionDate = new Date('2024-01-01T00:00:00Z');
        const pages = [
            { id: 'page-uuid-1', pageId: '728', name: 'Test Page', latestRevisionDate: revisionDate },
        ];

        mockGetRopewikiPageHtml.mockResolvedValue('<html>Page</html>');
        mockParseRopewikiPage.mockResolvedValue({
            beta: [{ title: 'Introduction', text: 'Text', order: 1 }],
            images: [],
        });
        mockUpsertBetaSections.mockResolvedValue({ 'Introduction': 'beta-id-1' });
        mockUpsertImages.mockResolvedValue([]);
        const deleteError = new Error('Delete beta sections error');
        mockSetBetaSectionsDeletedAt.mockRejectedValue(deleteError);

        // Database errors are caught, rolled back to savepoint, and function continues
        await parsePages(mockClient as unknown as db.Queryable, pages, mockLogger as unknown as ProgressLogger);
        
        expect(mockClient.query).toHaveBeenCalledWith('SAVEPOINT sp_page_0');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT sp_page_0');
        expect(mockLogger.logProgress).not.toHaveBeenCalled();
    });

    it('propagates errors from setImagesDeletedAt()', async () => {
        const revisionDate = new Date('2024-01-01T00:00:00Z');
        const pages = [
            { id: 'page-uuid-1', pageId: '728', name: 'Test Page', latestRevisionDate: revisionDate },
        ];

        mockGetRopewikiPageHtml.mockResolvedValue('<html>Page</html>');
        mockParseRopewikiPage.mockResolvedValue({
            beta: [{ title: 'Introduction', text: 'Text', order: 1 }],
            images: [{ fileUrl: 'image1.jpg', linkUrl: 'link1', betaSectionTitle: undefined, caption: undefined, order: 1 }],
        });
        mockUpsertBetaSections.mockResolvedValue({ 'Introduction': 'beta-id-1' });
        mockUpsertImages.mockResolvedValue(['image-id-1']);
        mockSetBetaSectionsDeletedAt.mockResolvedValue();
        const deleteError = new Error('Delete images error');
        mockSetImagesDeletedAt.mockRejectedValue(deleteError);

        // Database errors are caught, rolled back to savepoint, and function continues
        await parsePages(mockClient as unknown as db.Queryable, pages, mockLogger as unknown as ProgressLogger);
        
        expect(mockClient.query).toHaveBeenCalledWith('SAVEPOINT sp_page_0');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT sp_page_0');
        expect(mockLogger.logProgress).not.toHaveBeenCalled();
    });

    it('logs error and rolls back transaction on database error', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const revisionDate = new Date('2024-01-01T00:00:00Z');
        const pages = [
            { id: 'page-uuid-1', pageId: '728', name: 'Test Page', latestRevisionDate: revisionDate },
        ];

        mockGetRopewikiPageHtml.mockResolvedValue('<html>Page</html>');
        mockParseRopewikiPage.mockResolvedValue({
            beta: [{ title: 'Introduction', text: 'Text', order: 1 }],
            images: [],
        });
        mockUpsertBetaSections.mockResolvedValue({ 'Introduction': 'beta-id-1' });
        mockUpsertImages.mockResolvedValue([]);
        const dbError = new Error('Database error');
        mockSetBetaSectionsDeletedAt.mockRejectedValue(dbError);

        // Database errors are caught, rolled back to savepoint, and function continues
        await parsePages(mockClient as unknown as db.Queryable, pages, mockLogger as unknown as ProgressLogger);

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error processing page 728 Test Page, rolled back to savepoint:', dbError);
        expect(mockClient.query).toHaveBeenCalledWith('SAVEPOINT sp_page_0');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT sp_page_0');
        expect(mockLogger.logProgress).not.toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
    });
});

