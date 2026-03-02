import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Pool } from 'pg';
import { nodeProcessPagesChunk as processPagesChunk } from '../../../src/ropewiki/hook-functions/processPagesChunk';
import getRopewikiPageHtml from '../../../src/ropewiki/http/getRopewikiPageHtml';
import parseRopewikiPage from '../../../src/ropewiki/parsers/parseRopewikiPage';
import upsertBetaSections from '../../../src/ropewiki/database/upsertBetaSections';
import upsertImages from '../../../src/ropewiki/database/upsertImages';
import upsertSiteLinks from '../../../src/ropewiki/database/upsertSiteLinks';
import setBetaSectionsDeletedAt from '../../../src/ropewiki/database/setBetaSectionsDeletedAt';
import setImagesDeletedAt from '../../../src/ropewiki/database/setImagesDeletedAt';
import setPageSiteLinksDeletedAt from '../../../src/ropewiki/database/setPageSiteLinksDeletedAt';
import ProgressLogger from '../../../src/helpers/progressLogger';
import * as db from 'zapatos/db';
import RopewikiPage from '../../../src/ropewiki/types/page';

// Mock the dependencies
jest.mock('../../../src/ropewiki/http/getRopewikiPageHtml');
jest.mock('../../../src/ropewiki/parsers/parseRopewikiPage');
jest.mock('../../../src/ropewiki/database/upsertBetaSections');
jest.mock('../../../src/ropewiki/database/upsertImages');
jest.mock('../../../src/ropewiki/database/upsertSiteLinks');
jest.mock('../../../src/ropewiki/database/setBetaSectionsDeletedAt');
jest.mock('../../../src/ropewiki/database/setImagesDeletedAt');
jest.mock('../../../src/ropewiki/database/setPageSiteLinksDeletedAt');

const mockGetRopewikiPageHtml = getRopewikiPageHtml as jest.MockedFunction<typeof getRopewikiPageHtml>;
const mockParseRopewikiPage = parseRopewikiPage as jest.MockedFunction<typeof parseRopewikiPage>;
const mockUpsertBetaSections = upsertBetaSections as jest.MockedFunction<typeof upsertBetaSections>;
const mockUpsertImages = upsertImages as jest.MockedFunction<typeof upsertImages>;
const mockUpsertSiteLinks = upsertSiteLinks as jest.MockedFunction<typeof upsertSiteLinks>;
const mockSetBetaSectionsDeletedAt = setBetaSectionsDeletedAt as jest.MockedFunction<typeof setBetaSectionsDeletedAt>;
const mockSetImagesDeletedAt = setImagesDeletedAt as jest.MockedFunction<typeof setImagesDeletedAt>;
const mockSetPageSiteLinksDeletedAt = setPageSiteLinksDeletedAt as jest.MockedFunction<typeof setPageSiteLinksDeletedAt>;

describe('processPage', () => {
    let mockClient: {
        query: jest.MockedFunction<(query: string) => Promise<unknown>>;
    };
    let mockLogger: {
        logProgress: jest.MockedFunction<(message: string) => void>;
        logError: jest.MockedFunction<(message: string) => void>;
    };
    const regionNameIds = { 'Test Region': 'region-id-123' };

    const createPage = (pageid: string, name: string, id: string, revisionDate: Date): RopewikiPage => {
        const regionId = regionNameIds['Test Region'] || 'region-id-123';
        const url = `https://ropewiki.com/${name.replace(/\s+/g, '_')}`;
        return new RopewikiPage(
            pageid,
            name,
            regionId,
            url,
            revisionDate,
            undefined, // coordinates
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
            [], // months
            undefined, // shuttleTime
            undefined, // vehicle
            undefined, // minOverallTime
            undefined, // maxOverallTime
            undefined, // overallLength
            undefined, // approachLength
            undefined, // approachElevGain
            undefined, // descentLength
            undefined, // descentElevGain
            undefined, // exitLength
            undefined, // exitElevGain
            undefined, // minApproachTime
            undefined, // maxApproachTime
            undefined, // minDescentTime
            undefined, // maxDescentTime
            undefined, // minExitTime
            undefined, // maxExitTime
            [], // aka
            [], // betaSites
            undefined, // userVotes
            id // id
        );
    };

    beforeEach(() => {
        jest.clearAllMocks();
        // Create mock client (already in a transaction from processPagesForRegion)
        mockClient = {
            query: jest.fn<typeof mockClient.query>().mockResolvedValue({}),
        };

        // Create mock logger
        mockLogger = {
            logProgress: jest.fn(),
            logError: jest.fn(),
        };

        mockUpsertSiteLinks.mockResolvedValue(undefined);
    });

    it('processes pages successfully', async () => {
        const page1RevisionDate = new Date('2024-01-01T00:00:00Z');
        const page2RevisionDate = new Date('2024-01-02T00:00:00Z');
        
        const pages = [
            createPage('728', 'Bear Creek Canyon', 'page-uuid-1', page1RevisionDate),
            createPage('5597', 'Regions', 'page-uuid-2', page2RevisionDate),
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

        await processPagesChunk(mockClient as unknown as db.Queryable, pages, mockLogger as unknown as ProgressLogger);

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
        expect(mockUpsertSiteLinks).toHaveBeenCalledTimes(2);
        expect(mockSetBetaSectionsDeletedAt).toHaveBeenCalledTimes(2);
        expect(mockSetImagesDeletedAt).toHaveBeenCalledTimes(2);
        expect(mockSetPageSiteLinksDeletedAt).toHaveBeenCalledTimes(2);
    });



    it('calls setDeletedAt then upserts for each page', async () => {
        const revisionDate = new Date('2024-01-01T00:00:00Z');
        const pages = [
            createPage('728', 'Test Page', 'page-uuid-1', revisionDate),
        ];

        mockGetRopewikiPageHtml.mockResolvedValue('<html>Page</html>');
        mockParseRopewikiPage.mockResolvedValue({
            beta: [{ title: 'Introduction', text: 'Text', order: 1 }],
            images: [{ fileUrl: 'image1.jpg', linkUrl: 'link1', betaSectionTitle: undefined, caption: undefined, order: 1 }],
        });
        mockUpsertBetaSections.mockResolvedValue({ 'Introduction': 'beta-id-1' });
        mockUpsertImages.mockResolvedValue(['image-id-1']);

        await processPagesChunk(mockClient as unknown as db.Queryable, pages, mockLogger as unknown as ProgressLogger);

        // Should use savepoints instead of BEGIN/COMMIT
        expect(mockClient.query).toHaveBeenCalledWith('SAVEPOINT sp_page_0');
        expect(mockClient.query).toHaveBeenCalledWith('RELEASE SAVEPOINT sp_page_0');
        expect(mockSetBetaSectionsDeletedAt).toHaveBeenCalledWith(mockClient as unknown as db.Queryable, 'page-uuid-1');
        expect(mockSetImagesDeletedAt).toHaveBeenCalledWith(mockClient as unknown as db.Queryable, 'page-uuid-1');
        expect(mockSetPageSiteLinksDeletedAt).toHaveBeenCalledWith(mockClient as unknown as db.Queryable, 'page-uuid-1');
        expect(mockUpsertSiteLinks).toHaveBeenCalledWith(mockClient as unknown as db.Queryable, 'page-uuid-1', []);
    });


    it('propagates errors from getRopewikiPageHtml()', async () => {
        const revisionDate = new Date('2024-01-01T00:00:00Z');
        const pages = [
            createPage('728', 'Test Page', 'page-uuid-1', revisionDate),
        ];

        const htmlError = new Error('Failed to fetch HTML');
        mockGetRopewikiPageHtml.mockRejectedValue(htmlError);

        // HTTP errors are thrown all the way up the stack (not caught)
        await expect(processPagesChunk(mockClient as unknown as db.Queryable, pages, mockLogger as unknown as ProgressLogger)).rejects.toThrow('Failed to fetch HTML');
        
        expect(mockLogger.logProgress).not.toHaveBeenCalled();
        expect(mockClient.query).not.toHaveBeenCalled();
    });

    it('catches and logs parser errors from parseRopewikiPage()', async () => {
        const revisionDate = new Date('2024-01-01T00:00:00Z');
        const pages = [
            createPage('728', 'Test Page', 'page-uuid-1', revisionDate),
        ];

        mockGetRopewikiPageHtml.mockResolvedValue('<html>Page</html>');
        const parseError = new Error('Parse error');
        mockParseRopewikiPage.mockRejectedValue(parseError);

        // Parser errors are caught, logged, and savepoint is rolled back (not propagated)
        await processPagesChunk(mockClient as unknown as db.Queryable, pages, mockLogger as unknown as ProgressLogger);
        
        expect(mockClient.query).toHaveBeenCalledWith('SAVEPOINT sp_page_0');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT sp_page_0');
        expect(mockLogger.logError).toHaveBeenCalledWith('Error processing page 728 Test Page, rolled back to savepoint: Parse error');
        expect(mockLogger.logProgress).not.toHaveBeenCalled();
    });

    it('propagates errors from upsertBetaSections()', async () => {
        const revisionDate = new Date('2024-01-01T00:00:00Z');
        const pages = [
            createPage('728', 'Test Page', 'page-uuid-1', revisionDate),
        ];

        mockGetRopewikiPageHtml.mockResolvedValue('<html>Page</html>');
        mockParseRopewikiPage.mockResolvedValue({
            beta: [{ title: 'Introduction', text: 'Text', order: 1 }],
            images: [],
        });
        const betaError = new Error('Beta sections error');
        mockUpsertBetaSections.mockRejectedValue(betaError);

        // Database errors are caught, logged, and savepoint is rolled back (not propagated)
        await processPagesChunk(mockClient as unknown as db.Queryable, pages, mockLogger as unknown as ProgressLogger);
        
        expect(mockClient.query).toHaveBeenCalledWith('SAVEPOINT sp_page_0');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT sp_page_0');
        expect(mockLogger.logError).toHaveBeenCalledWith('Error processing page 728 Test Page, rolled back to savepoint: Beta sections error');
        expect(mockLogger.logProgress).not.toHaveBeenCalled();
    });

    it('propagates errors from upsertImages()', async () => {
        const revisionDate = new Date('2024-01-01T00:00:00Z');
        const pages = [
            createPage('728', 'Test Page', 'page-uuid-1', revisionDate),
        ];

        mockGetRopewikiPageHtml.mockResolvedValue('<html>Page</html>');
        mockParseRopewikiPage.mockResolvedValue({
            beta: [{ title: 'Introduction', text: 'Text', order: 1 }],
            images: [{ fileUrl: 'image1.jpg', linkUrl: 'link1', betaSectionTitle: undefined, caption: undefined, order: 1 }],
        });
        mockUpsertBetaSections.mockResolvedValue({ 'Introduction': 'beta-id-1' });
        const imagesError = new Error('Images error');
        mockUpsertImages.mockRejectedValue(imagesError);

        // Database errors are caught, logged, and savepoint is rolled back (not propagated)
        await processPagesChunk(mockClient as unknown as db.Queryable, pages, mockLogger as unknown as ProgressLogger);
        
        expect(mockClient.query).toHaveBeenCalledWith('SAVEPOINT sp_page_0');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT sp_page_0');
        expect(mockLogger.logError).toHaveBeenCalledWith('Error processing page 728 Test Page, rolled back to savepoint: Images error');
        expect(mockLogger.logProgress).not.toHaveBeenCalled();
    });

    it('propagates errors from setPageSiteLinksDeletedAt()', async () => {
        const revisionDate = new Date('2024-01-01T00:00:00Z');
        const pages = [
            createPage('728', 'Test Page', 'page-uuid-1', revisionDate),
        ];

        mockGetRopewikiPageHtml.mockResolvedValue('<html>Page</html>');
        mockParseRopewikiPage.mockResolvedValue({
            beta: [{ title: 'Introduction', text: 'Text', order: 1 }],
            images: [],
        });
        mockUpsertBetaSections.mockResolvedValue({ 'Introduction': 'beta-id-1' });
        mockUpsertImages.mockResolvedValue([]);
        const deleteError = new Error('Delete page site links error');
        mockSetPageSiteLinksDeletedAt.mockRejectedValue(deleteError);

        await processPagesChunk(mockClient as unknown as db.Queryable, pages, mockLogger as unknown as ProgressLogger);

        expect(mockClient.query).toHaveBeenCalledWith('SAVEPOINT sp_page_0');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT sp_page_0');
        expect(mockLogger.logError).toHaveBeenCalledWith('Error processing page 728 Test Page, rolled back to savepoint: Delete page site links error');
        expect(mockLogger.logProgress).not.toHaveBeenCalled();
    });

    it('propagates errors from upsertSiteLinks()', async () => {
        const revisionDate = new Date('2024-01-01T00:00:00Z');
        const pages = [
            createPage('728', 'Test Page', 'page-uuid-1', revisionDate),
        ];

        mockGetRopewikiPageHtml.mockResolvedValue('<html>Page</html>');
        mockParseRopewikiPage.mockResolvedValue({
            beta: [{ title: 'Introduction', text: 'Text', order: 1 }],
            images: [],
        });
        mockUpsertBetaSections.mockResolvedValue({ 'Introduction': 'beta-id-1' });
        mockUpsertImages.mockResolvedValue([]);
        mockSetPageSiteLinksDeletedAt.mockResolvedValue();
        const siteLinksError = new Error('Site links error');
        mockUpsertSiteLinks.mockRejectedValue(siteLinksError);

        await processPagesChunk(mockClient as unknown as db.Queryable, pages, mockLogger as unknown as ProgressLogger);

        expect(mockClient.query).toHaveBeenCalledWith('SAVEPOINT sp_page_0');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT sp_page_0');
        expect(mockLogger.logError).toHaveBeenCalledWith('Error processing page 728 Test Page, rolled back to savepoint: Site links error');
        expect(mockLogger.logProgress).not.toHaveBeenCalled();
    });

    it('propagates errors from setBetaSectionsDeletedAt()', async () => {
        const revisionDate = new Date('2024-01-01T00:00:00Z');
        const pages = [
            createPage('728', 'Test Page', 'page-uuid-1', revisionDate),
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

        // Database errors are caught, logged, and savepoint is rolled back (not propagated)
        await processPagesChunk(mockClient as unknown as db.Queryable, pages, mockLogger as unknown as ProgressLogger);
        
        expect(mockClient.query).toHaveBeenCalledWith('SAVEPOINT sp_page_0');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT sp_page_0');
        expect(mockLogger.logError).toHaveBeenCalledWith('Error processing page 728 Test Page, rolled back to savepoint: Delete beta sections error');
        expect(mockLogger.logProgress).not.toHaveBeenCalled();
    });

    it('propagates errors from setImagesDeletedAt()', async () => {
        const revisionDate = new Date('2024-01-01T00:00:00Z');
        const pages = [
            createPage('728', 'Test Page', 'page-uuid-1', revisionDate),
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

        // Database errors are caught, logged, and savepoint is rolled back (not propagated)
        await processPagesChunk(mockClient as unknown as db.Queryable, pages, mockLogger as unknown as ProgressLogger);
        
        expect(mockClient.query).toHaveBeenCalledWith('SAVEPOINT sp_page_0');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT sp_page_0');
        expect(mockLogger.logError).toHaveBeenCalledWith('Error processing page 728 Test Page, rolled back to savepoint: Delete images error');
        expect(mockLogger.logProgress).not.toHaveBeenCalled();
    });

    it('logs error and rolls back transaction on database error', async () => {
        const revisionDate = new Date('2024-01-01T00:00:00Z');
        const pages = [
            createPage('728', 'Test Page', 'page-uuid-1', revisionDate),
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

        // Database errors are caught, logged, and savepoint is rolled back (not propagated)
        await processPagesChunk(mockClient as unknown as db.Queryable, pages, mockLogger as unknown as ProgressLogger);

        expect(mockLogger.logError).toHaveBeenCalledWith('Error processing page 728 Test Page, rolled back to savepoint: Database error');
        expect(mockClient.query).toHaveBeenCalledWith('SAVEPOINT sp_page_0');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT sp_page_0');
        expect(mockLogger.logProgress).not.toHaveBeenCalled();
    });
});

