import { Pool } from 'pg';
import * as db from 'zapatos/db';
import { describe, it, expect, afterEach, beforeAll, afterAll } from '@jest/globals';
import setPageSiteLinksDeletedAt from '../../../src/ropewiki/database/setPageSiteLinksDeletedAt';
import upsertSiteLinks from '../../../src/ropewiki/database/upsertSiteLinks';
import RopewikiPage from '../../../src/ropewiki/types/page';
import upsertPages from '../../../src/ropewiki/database/upsertPages';

describe('setPageSiteLinksDeletedAt (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;
    const testRegionId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
    const regionNameIds: { [name: string]: string } = { 'Test Region': testRegionId };
    let testPageUuid: string;
    let otherPageUuid: string;

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiPageSiteLink"`.run(conn);
        await db.sql`DELETE FROM "RopewikiSiteLink"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);

        await db
            .insert('RopewikiRegion', {
                id: testRegionId,
                parentRegion: null,
                name: 'Test Region',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                pageCount: 0,
                level: 0,
                bestMonths: JSON.stringify([]),
                url: 'https://ropewiki.com/Test_Region',
            })
            .run(conn);

        const latestRevisionDate = new Date('2025-01-01T00:00:00Z');
        const pageInfo = RopewikiPage.fromResponseBody(
            {
                printouts: {
                    pageid: ['9999'],
                    name: ['Test Page'],
                    region: [{ fulltext: 'Test Region' }],
                    url: ['https://ropewiki.com/Test_Page'],
                    latestRevisionDate: [
                        {
                            timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)),
                            raw: '2025-01-01T00:00:00Z',
                        },
                    ],
                },
            },
            regionNameIds
        );
        const otherPageInfo = RopewikiPage.fromResponseBody(
            {
                printouts: {
                    pageid: ['8888'],
                    name: ['Other Page'],
                    region: [{ fulltext: 'Test Region' }],
                    url: ['https://ropewiki.com/Other_Page'],
                    latestRevisionDate: [
                        {
                            timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)),
                            raw: '2025-01-01T00:00:00Z',
                        },
                    ],
                },
            },
            regionNameIds
        );
        const results = await upsertPages(conn, [pageInfo, otherPageInfo]);
        expect(results).toHaveLength(2);
        testPageUuid = results[0]!.id ?? '';
        otherPageUuid = results[1]!.id ?? '';
        expect(testPageUuid).toBeTruthy();
        expect(otherPageUuid).toBeTruthy();
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "RopewikiPageSiteLink"`.run(conn);
        await db.sql`DELETE FROM "RopewikiSiteLink"`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiPageSiteLink"`.run(conn);
        await db.sql`DELETE FROM "RopewikiSiteLink"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
        await pool.end();
    });

    it('sets deletedAt for all page-site links for the page', async () => {
        await upsertSiteLinks(conn, testPageUuid, [
            'https://example.com/link1',
            'https://example.com/link2',
        ]);

        const beforeRows = await db.select('RopewikiPageSiteLink', { page: testPageUuid }).run(conn);
        expect(beforeRows).toHaveLength(2);
        beforeRows.forEach((row) => expect(row.deletedAt).toBeNull());

        await setPageSiteLinksDeletedAt(conn, testPageUuid);

        const afterRows = await db.select('RopewikiPageSiteLink', { page: testPageUuid }).run(conn);
        expect(afterRows).toHaveLength(2);
        afterRows.forEach((row) => {
            expect(row.deletedAt).not.toBeNull();
            expect(new Date(row.deletedAt as string).getTime()).toBeCloseTo(Date.now(), -3);
        });
    });

    it('only affects page-site links for the specified pageUuid', async () => {
        await upsertSiteLinks(conn, testPageUuid, ['https://example.com/page1-link']);
        await upsertSiteLinks(conn, otherPageUuid, ['https://example.com/page2-link']);

        await setPageSiteLinksDeletedAt(conn, testPageUuid);

        const page1Rows = await db.select('RopewikiPageSiteLink', { page: testPageUuid }).run(conn);
        expect(page1Rows).toHaveLength(1);
        expect(page1Rows[0]?.deletedAt).not.toBeNull();

        const page2Rows = await db.select('RopewikiPageSiteLink', { page: otherPageUuid }).run(conn);
        expect(page2Rows).toHaveLength(1);
        expect(page2Rows[0]?.deletedAt).toBeNull();
    });

    it('does not update deletedAt for links that already have deletedAt set', async () => {
        await upsertSiteLinks(conn, testPageUuid, ['https://example.com/fresh']);
        const freshSiteLinkRows = await db.select('RopewikiSiteLink', { url: 'https://example.com/fresh' }).run(conn);
        const freshSiteLinkId = freshSiteLinkRows[0]?.id;
        expect(freshSiteLinkId).toBeDefined();

        const oldDeletedAt = new Date('2025-01-01T10:00:00Z');
        await db.insert('RopewikiSiteLink', { url: 'https://example.com/already-deleted' }).run(conn);
        const alreadyDeletedSiteLinkRows = await db.select('RopewikiSiteLink', { url: 'https://example.com/already-deleted' }).run(conn);
        const alreadyDeletedSiteLinkId = alreadyDeletedSiteLinkRows[0]?.id;
        expect(alreadyDeletedSiteLinkId).toBeDefined();

        await db
            .insert('RopewikiPageSiteLink', {
                page: testPageUuid,
                siteLink: alreadyDeletedSiteLinkId!,
                deletedAt: oldDeletedAt.toISOString() as db.TimestampString,
            })
            .run(conn);

        const beforeRows = await db.select('RopewikiPageSiteLink', { page: testPageUuid }).run(conn);
        expect(beforeRows).toHaveLength(2);
        const beforeAlreadyDeleted = beforeRows.find((r) => r.siteLink === alreadyDeletedSiteLinkId);
        expect(beforeAlreadyDeleted?.deletedAt).not.toBeNull();
        const beforeDeletedAtValue = beforeAlreadyDeleted?.deletedAt as string;

        await new Promise((resolve) => setTimeout(resolve, 100));
        await setPageSiteLinksDeletedAt(conn, testPageUuid);

        const afterRows = await db.select('RopewikiPageSiteLink', { page: testPageUuid }).run(conn);
        expect(afterRows).toHaveLength(2);

        const previouslyDeletedRow = afterRows.find((r) => r.siteLink === alreadyDeletedSiteLinkId);
        expect(previouslyDeletedRow?.deletedAt).not.toBeNull();
        expect(previouslyDeletedRow!.deletedAt).toBe(beforeDeletedAtValue);

        const freshRow = afterRows.find((r) => r.siteLink === freshSiteLinkId);
        expect(freshRow?.deletedAt).not.toBeNull();
        expect(new Date(freshRow!.deletedAt as string).getTime()).toBeCloseTo(Date.now(), -3);
    });
});
