import { Pool } from 'pg';
import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { describe, it, expect, afterEach, beforeAll, afterAll } from '@jest/globals';
import upsertSiteLinks from '../../../src/ropewiki/database/upsertSiteLinks';
import RopewikiPage from '../../../src/ropewiki/types/page';
import upsertPages from '../../../src/ropewiki/database/upsertPages';

describe('upsertSiteLinks (integration)', () => {
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

    it('does nothing when siteLinks array is empty', async () => {
        await upsertSiteLinks(conn, testPageUuid, []);

        const siteLinkRows = await db.select('RopewikiSiteLink', {}).run(conn);
        const pageSiteLinkRows = await db.select('RopewikiPageSiteLink', {}).run(conn);
        expect(siteLinkRows).toHaveLength(0);
        expect(pageSiteLinkRows).toHaveLength(0);
    });

    it('inserts site links and page-site links', async () => {
        const siteLinks = [
            'https://example.com/beta1',
            'https://example.com/beta2',
        ];

        await upsertSiteLinks(conn, testPageUuid, siteLinks);

        const siteLinkRows = await db.select('RopewikiSiteLink', {}).run(conn);
        expect(siteLinkRows).toHaveLength(2);
        expect(siteLinkRows.map((r) => r.url).sort()).toEqual([
            'https://example.com/beta1',
            'https://example.com/beta2',
        ]);

        const pageSiteLinkRows = await db
            .select('RopewikiPageSiteLink', { page: testPageUuid })
            .run(conn);
        expect(pageSiteLinkRows).toHaveLength(2);
        const siteLinkIds = siteLinkRows.map((r) => r.id);
        pageSiteLinkRows.forEach((ps) => {
            expect(siteLinkIds).toContain(ps.siteLink);
            expect(ps.deletedAt).toBeNull();
        });
    });

    it('reuses existing RopewikiSiteLink when same URL is used by another page', async () => {
        const sharedUrl = 'https://shared.com/beta';
        await upsertSiteLinks(conn, testPageUuid, [sharedUrl]);

        const siteLinksBefore = await db.select('RopewikiSiteLink', { url: sharedUrl }).run(conn);
        expect(siteLinksBefore).toHaveLength(1);
        const siteLinkId = siteLinksBefore[0]!.id;

        await upsertSiteLinks(conn, otherPageUuid, [sharedUrl]);

        const siteLinksAfter = await db.select('RopewikiSiteLink', {}).run(conn);
        expect(siteLinksAfter).toHaveLength(1);
        expect(siteLinksAfter[0]!.id).toBe(siteLinkId);

        const pageSiteLinks = await db.select('RopewikiPageSiteLink', {}).run(conn);
        expect(pageSiteLinks).toHaveLength(2);
        expect(pageSiteLinks.filter((ps) => ps.page === testPageUuid)).toHaveLength(1);
        expect(pageSiteLinks.filter((ps) => ps.page === otherPageUuid)).toHaveLength(1);
        expect(pageSiteLinks.every((ps) => ps.siteLink === siteLinkId)).toBe(true);
    });

    it('sets deletedAt to null when re-adding a previously soft-deleted link', async () => {
        await upsertSiteLinks(conn, testPageUuid, ['https://restored.com/beta']);

        const pageSiteLinks = await db.select('RopewikiPageSiteLink', { page: testPageUuid }).run(conn);
        const siteLinkId = pageSiteLinks[0]!.siteLink;

        await db
            .update(
                'RopewikiPageSiteLink',
                { deletedAt: new Date() },
                { page: testPageUuid, siteLink: siteLinkId }
            )
            .run(conn);

        const beforeRows = await db.select('RopewikiPageSiteLink', { page: testPageUuid }).run(conn);
        expect(beforeRows[0]?.deletedAt).not.toBeNull();

        await upsertSiteLinks(conn, testPageUuid, ['https://restored.com/beta']);

        const afterRows = await db.select('RopewikiPageSiteLink', { page: testPageUuid }).run(conn);
        expect(afterRows).toHaveLength(1);
        expect(afterRows[0]?.deletedAt).toBeNull();
    });

    it('deduplicates URLs in input', async () => {
        const siteLinks = [
            'https://dup.com/beta',
            'https://dup.com/beta',
            'https://dup.com/beta',
        ];

        await upsertSiteLinks(conn, testPageUuid, siteLinks);

        const siteLinkRows = await db.select('RopewikiSiteLink', {}).run(conn);
        expect(siteLinkRows).toHaveLength(1);
        expect(siteLinkRows[0]?.url).toBe('https://dup.com/beta');

        const pageSiteLinkRows = await db.select('RopewikiPageSiteLink', { page: testPageUuid }).run(conn);
        expect(pageSiteLinkRows).toHaveLength(1);
    });

    it('filters empty and whitespace-only URLs', async () => {
        const siteLinks = [
            'https://valid.com/beta',
            '',
            '   ',
            'https://also-valid.com/beta',
        ];

        await upsertSiteLinks(conn, testPageUuid, siteLinks);

        const siteLinkRows = await db.select('RopewikiSiteLink', {}).run(conn);
        expect(siteLinkRows).toHaveLength(2);
        expect(siteLinkRows.map((r) => r.url).sort()).toEqual([
            'https://also-valid.com/beta',
            'https://valid.com/beta',
        ]);

        const pageSiteLinkRows = await db.select('RopewikiPageSiteLink', { page: testPageUuid }).run(conn);
        expect(pageSiteLinkRows).toHaveLength(2);
    });
});
