import { Pool } from 'pg';
import * as db from 'zapatos/db';
import { describe, it, expect, afterEach, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import type { ProcessPagesChunkHookFn } from '../../../src/ropewiki/hook-functions/processPagesChunk';
import RopewikiPage from '../../../src/ropewiki/types/page';

jest.mock('../../../src/ropewiki/http/getRopewikiPageForRegion');

import getRopewikiPageForRegion from '../../../src/ropewiki/http/getRopewikiPageForRegion';
import { getProcessPagesForRegionFn } from '../../../src/ropewiki/processors/processPagesForRegion';
import upsertPages from '../../../src/ropewiki/database/upsertPages';

const mockGetRopewikiPageForRegion = getRopewikiPageForRegion as jest.MockedFunction<typeof getRopewikiPageForRegion>;

describe('processPagesForRegion (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;
    const testRegionId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
    const regionName = 'Test Region';
    const regionNameIds: { [name: string]: string } = { [regionName]: testRegionId };

    let mockProcessPagesChunkHookFn: jest.MockedFunction<ProcessPagesChunkHookFn>;

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);

        await db
            .insert('RopewikiRegion', {
                id: testRegionId,
                parentRegion: null,
                name: regionName,
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                pageCount: 0,
                level: 0,
                bestMonths: JSON.stringify([]),
                url: 'https://ropewiki.com/Test_Region',
            })
            .run(conn);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.AWS_LAMBDA_FUNCTION_NAME;
        delete process.env.LAMBDA_TASK_ROOT;
        mockProcessPagesChunkHookFn = jest.fn<ProcessPagesChunkHookFn>().mockResolvedValue(undefined);
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
        await pool.end();
    });

    const createValidPage = (
        pageid: string,
        name: string,
        revisionDate: Date
    ): RopewikiPage => {
        return RopewikiPage.fromResponseBody(
            {
                printouts: {
                    pageid: [pageid],
                    name: [name],
                    region: [{ fulltext: regionName }],
                    url: [`https://ropewiki.com/${name.replace(/\s+/g, '_')}`],
                    latestRevisionDate: [
                        {
                            timestamp: String(Math.floor(revisionDate.getTime() / 1000)),
                            raw: revisionDate.toISOString(),
                        },
                    ],
                },
            },
            regionNameIds
        );
    };

    it('pages in the database not returned by getRopewikiPageForRegion remain deleted after run', async () => {
        const pageARevision = new Date('2025-01-01T00:00:00Z');
        const pageBRevision = new Date('2025-01-01T00:00:00Z');

        await db
            .insert('RopewikiPage', [
                {
                    pageId: '1001',
                    name: 'Page A',
                    region: testRegionId,
                    url: 'https://ropewiki.com/Page_A',
                    months: [],
                    latestRevisionDate: pageARevision.toISOString() as db.TimestampString,
                },
                {
                    pageId: '1002',
                    name: 'Page B',
                    region: testRegionId,
                    url: 'https://ropewiki.com/Page_B',
                    months: [],
                    latestRevisionDate: pageBRevision.toISOString() as db.TimestampString,
                },
            ])
            .run(conn);

        mockGetRopewikiPageForRegion.mockResolvedValue([
            createValidPage('1002', 'Page B', pageBRevision),
        ]);

        const processPagesForRegion = getProcessPagesForRegionFn(pool, mockProcessPagesChunkHookFn, true);
        await processPagesForRegion(regionName, 1, regionNameIds);

        const pageARows = await db.select('RopewikiPage', { pageId: '1001' }).run(conn);
        const pageBRows = await db.select('RopewikiPage', { pageId: '1002' }).run(conn);

        expect(pageARows).toHaveLength(1);
        expect(pageARows[0]?.deletedAt).not.toBeNull();

        expect(pageBRows).toHaveLength(1);
        expect(pageBRows[0]?.deletedAt).toBeNull();
    });

    it('only invokes processPagesChunkHookFn for pages not in DB or with latestRevisionDate after updatedAt', async () => {
        const newPageRevision = new Date('2025-01-02T00:00:00Z');
        const updatedPageRevision = new Date('2025-01-03T00:00:00Z');
        const stalePageRevision = new Date('2025-01-01T00:00:00Z');

        const newPage = createValidPage('2001', 'New Page', newPageRevision);
        const existingUpdatedPage = createValidPage('2002', 'Updated Page', updatedPageRevision);
        const existingStalePage = createValidPage('2003', 'Stale Page', stalePageRevision);

        await upsertPages(conn, [existingUpdatedPage, existingStalePage]);

        await db
            .update(
                'RopewikiPage',
                { updatedAt: new Date('2025-01-01T00:00:00Z').toISOString() as db.TimestampString },
                { pageId: '2002' }
            )
            .run(conn);
        await db
            .update(
                'RopewikiPage',
                { updatedAt: new Date('2025-01-02T12:00:00Z').toISOString() as db.TimestampString },
                { pageId: '2003' }
            )
            .run(conn);

        mockGetRopewikiPageForRegion.mockResolvedValue([
            newPage,
            createValidPage('2002', 'Updated Page', updatedPageRevision),
            createValidPage('2003', 'Stale Page', stalePageRevision),
        ]);

        const processPagesForRegion = getProcessPagesForRegionFn(pool, mockProcessPagesChunkHookFn, true);
        await processPagesForRegion(regionName, 3, regionNameIds);

        expect(mockProcessPagesChunkHookFn).toHaveBeenCalledTimes(1);
        const [client, parsedPages] = mockProcessPagesChunkHookFn.mock.calls[0]!;
        expect(client).toBeDefined();
        const pageIds = parsedPages.map((p: RopewikiPage) => p.pageid);
        expect(pageIds).toContain('2001');
        expect(pageIds).toContain('2002');
        expect(pageIds).not.toContain('2003');
    });
});
