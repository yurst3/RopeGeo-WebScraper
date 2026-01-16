import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import processRegionsPage from '../../processors/processRegionsPage';
import type { RopewikiRegion } from '../../types/ropewiki';

// Mock all dependencies
jest.mock('../http/getRopewikiPageRevisionDate');
jest.mock('../database/getUpdatedDateForRegions');
jest.mock('../http/getRopewikiPageHtml');
jest.mock('../parsers/parseRopewikiRegions');
jest.mock('../database/upsertRegions');
jest.mock('../database/getRegions');

// Mock uuid to avoid Jest ESM parsing issues while keeping deterministic IDs for tests
jest.mock('uuid', () => ({
    v5: (value: string, namespace: string): string => value, // eslint-disable-line @typescript-eslint/no-unused-vars
}));

import getRopewikiPagesRevisionDates from '../../http/getRopewikiPageRevisionDate';
import getUpdatedDateForRegions from '../../database/getUpdatedDateForRegions';
import getRopewikiPageHtml from '../../http/getRopewikiPageHtml';
import parseRopewikiRegions from '../../parsers/parseRopewikiRegions';
import upsertRegions from '../../database/upsertRegions';
import getRegions from '../../database/getRegions';

const mockedGetRopewikiPagesRevisionDates = getRopewikiPagesRevisionDates as jest.MockedFunction<typeof getRopewikiPagesRevisionDates>;
const mockedGetUpdatedDateForRegions = getUpdatedDateForRegions as jest.MockedFunction<typeof getUpdatedDateForRegions>;
const mockedGetRopewikiPageHtml = getRopewikiPageHtml as jest.MockedFunction<typeof getRopewikiPageHtml>;
const mockedParseRopewikiRegions = parseRopewikiRegions as jest.MockedFunction<typeof parseRopewikiRegions>;
const mockedUpsertRegions = upsertRegions as jest.MockedFunction<typeof upsertRegions>;
const mockedGetRegions = getRegions as jest.MockedFunction<typeof getRegions>;

describe('processRegionsPage', () => {
    const conn = {} as db.Queryable;
    const REGIONS_PAGE_ID = '5597';

    const mockRegions: RopewikiRegion[] = [
        { id: 'id-1', name: 'World', parentRegion: undefined },
        { id: 'id-2', name: 'Africa', parentRegion: 'id-1' },
    ];

    const mockDbRegions: s.RopewikiRegion.JSONSelectable[] = [
        {
            id: 'id-1',
            name: 'World',
            parentRegion: null,
            createdAt: '2025-01-01T00:00:00' as db.TimestampString,
            updatedAt: '2025-01-02T00:00:00' as db.TimestampString,
            deletedAt: null,
            latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
        },
        {
            id: 'id-2',
            name: 'Africa',
            parentRegion: 'id-1',
            createdAt: '2025-01-01T00:00:00' as db.TimestampString,
            updatedAt: '2025-01-02T00:00:00' as db.TimestampString,
            deletedAt: null,
            latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('success - updatedAt is null', async () => {
        const revisionDate = new Date('2025-01-15T00:00:00Z');
        mockedGetRopewikiPagesRevisionDates.mockResolvedValue({ [REGIONS_PAGE_ID]: revisionDate });
        mockedGetUpdatedDateForRegions.mockResolvedValue(null);
        mockedGetRopewikiPageHtml.mockResolvedValue('<html>regions html</html>');
        mockedParseRopewikiRegions.mockResolvedValue(mockRegions);
        mockedUpsertRegions.mockResolvedValue(undefined);

        const result = await processRegionsPage(conn);

        expect(mockedGetRopewikiPagesRevisionDates).toHaveBeenCalledWith([REGIONS_PAGE_ID]);
        expect(mockedGetUpdatedDateForRegions).toHaveBeenCalledWith(conn);
        expect(mockedGetRopewikiPageHtml).toHaveBeenCalledWith(REGIONS_PAGE_ID);
        expect(mockedParseRopewikiRegions).toHaveBeenCalledWith('<html>regions html</html>');
        expect(mockedUpsertRegions).toHaveBeenCalledWith(conn, mockRegions, revisionDate);
        expect(result).toEqual({ World: 'id-1', Africa: 'id-2' });
    });

    it('success - updatedAt is before the revision date', async () => {
        const revisionDate = new Date('2025-01-15T00:00:00Z');
        const updatedAt = new Date('2025-01-10T00:00:00Z');
        mockedGetRopewikiPagesRevisionDates.mockResolvedValue({ [REGIONS_PAGE_ID]: revisionDate });
        mockedGetUpdatedDateForRegions.mockResolvedValue(updatedAt);
        mockedGetRopewikiPageHtml.mockResolvedValue('<html>regions html</html>');
        mockedParseRopewikiRegions.mockResolvedValue(mockRegions);
        mockedUpsertRegions.mockResolvedValue(undefined);

        const result = await processRegionsPage(conn);

        expect(mockedGetRopewikiPagesRevisionDates).toHaveBeenCalledWith([REGIONS_PAGE_ID]);
        expect(mockedGetUpdatedDateForRegions).toHaveBeenCalledWith(conn);
        expect(mockedGetRopewikiPageHtml).toHaveBeenCalledWith(REGIONS_PAGE_ID);
        expect(mockedParseRopewikiRegions).toHaveBeenCalledWith('<html>regions html</html>');
        expect(mockedUpsertRegions).toHaveBeenCalledWith(conn, mockRegions, revisionDate);
        expect(result).toEqual({ World: 'id-1', Africa: 'id-2' });
    });

    it('success - updatedAt is after the revision date', async () => {
        const revisionDate = new Date('2025-01-10T00:00:00Z');
        const updatedAt = new Date('2025-01-15T00:00:00Z');
        mockedGetRopewikiPagesRevisionDates.mockResolvedValue({ [REGIONS_PAGE_ID]: revisionDate });
        mockedGetUpdatedDateForRegions.mockResolvedValue(updatedAt);
        mockedGetRegions.mockResolvedValue(mockDbRegions);

        const result = await processRegionsPage(conn);

        expect(mockedGetRopewikiPagesRevisionDates).toHaveBeenCalledWith([REGIONS_PAGE_ID]);
        expect(mockedGetUpdatedDateForRegions).toHaveBeenCalledWith(conn);
        expect(mockedGetRopewikiPageHtml).not.toHaveBeenCalled();
        expect(mockedParseRopewikiRegions).not.toHaveBeenCalled();
        expect(mockedUpsertRegions).not.toHaveBeenCalled();
        expect(mockedGetRegions).toHaveBeenCalledWith(conn);
        expect(result).toEqual({ World: 'id-1', Africa: 'id-2' });
    });

    it('failure - getRopewikiPagesRevisionDates() throws an error', async () => {
        const error = new Error('Network error');
        mockedGetRopewikiPagesRevisionDates.mockRejectedValue(error);

        await expect(processRegionsPage(conn)).rejects.toThrow('Network error');
        expect(mockedGetUpdatedDateForRegions).not.toHaveBeenCalled();
    });

    it('failure - getRopewikiPagesRevisionDates() doesn\'t return a date for REGIONS_PAGE_ID', async () => {
        mockedGetRopewikiPagesRevisionDates.mockResolvedValue({ [REGIONS_PAGE_ID]: null });

        await expect(processRegionsPage(conn)).rejects.toThrow('Error getting Regions page revision date');
        expect(mockedGetUpdatedDateForRegions).not.toHaveBeenCalled();
    });

    it('failure - getUpdatedDateForRegions() throws an error', async () => {
        const revisionDate = new Date('2025-01-15T00:00:00Z');
        const error = new Error('Database connection error');
        mockedGetRopewikiPagesRevisionDates.mockResolvedValue({ [REGIONS_PAGE_ID]: revisionDate });
        mockedGetUpdatedDateForRegions.mockRejectedValue(error);

        await expect(processRegionsPage(conn)).rejects.toThrow('Database connection error');
        expect(mockedGetRopewikiPageHtml).not.toHaveBeenCalled();
    });

    it('failure - getRopewikiPageHtml() throws an error', async () => {
        const revisionDate = new Date('2025-01-15T00:00:00Z');
        const error = new Error('HTTP error');
        mockedGetRopewikiPagesRevisionDates.mockResolvedValue({ [REGIONS_PAGE_ID]: revisionDate });
        mockedGetUpdatedDateForRegions.mockResolvedValue(null);
        mockedGetRopewikiPageHtml.mockRejectedValue(error);

        await expect(processRegionsPage(conn)).rejects.toThrow('HTTP error');
        expect(mockedParseRopewikiRegions).not.toHaveBeenCalled();
    });

    it('failure - parseRopewikiRegions() throws an error', async () => {
        const revisionDate = new Date('2025-01-15T00:00:00Z');
        const error = new Error('Parse error');
        mockedGetRopewikiPagesRevisionDates.mockResolvedValue({ [REGIONS_PAGE_ID]: revisionDate });
        mockedGetUpdatedDateForRegions.mockResolvedValue(null);
        mockedGetRopewikiPageHtml.mockResolvedValue('<html>regions html</html>');
        mockedParseRopewikiRegions.mockRejectedValue(error);

        await expect(processRegionsPage(conn)).rejects.toThrow('Parse error');
        expect(mockedUpsertRegions).not.toHaveBeenCalled();
    });

    it('failure - upsertRegions() throws an error', async () => {
        const revisionDate = new Date('2025-01-15T00:00:00Z');
        const error = new Error('Upsert error');
        mockedGetRopewikiPagesRevisionDates.mockResolvedValue({ [REGIONS_PAGE_ID]: revisionDate });
        mockedGetUpdatedDateForRegions.mockResolvedValue(null);
        mockedGetRopewikiPageHtml.mockResolvedValue('<html>regions html</html>');
        mockedParseRopewikiRegions.mockResolvedValue(mockRegions);
        mockedUpsertRegions.mockRejectedValue(error);

        await expect(processRegionsPage(conn)).rejects.toThrow('Upsert error');
    });

    it('failure - getRegions() throws an error', async () => {
        const revisionDate = new Date('2025-01-10T00:00:00Z');
        const updatedAt = new Date('2025-01-15T00:00:00Z');
        const error = new Error('Get regions error');
        mockedGetRopewikiPagesRevisionDates.mockResolvedValue({ [REGIONS_PAGE_ID]: revisionDate });
        mockedGetUpdatedDateForRegions.mockResolvedValue(updatedAt);
        mockedGetRegions.mockRejectedValue(error);

        await expect(processRegionsPage(conn)).rejects.toThrow('Get regions error');
    });
});

