import { Pool } from 'pg';
import * as db from 'zapatos/db';
import { describe, it, expect, afterEach, beforeAll, afterAll } from '@jest/globals';
import setAkaNamesDeletedAtForRegion from '../../../src/ropewiki/database/setAkaNamesDeletedAtForRegion';
import upsertAkaNames from '../../../src/ropewiki/database/upsertAkaNames';
import RopewikiPage from '../../../src/ropewiki/types/page';

describe('setAkaNamesDeletedAtForRegion (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;
    const parentRegionId = 'aaaaaaaa-aaaa-4e48-99a6-81608cc0051d';
    const childRegionId = 'bbbbbbbb-bbbb-4e48-99a6-81608cc0051d';
    const otherRegionId = 'cccccccc-cccc-4e48-99a6-81608cc0051d';
    const regionNameIds: { [name: string]: string } = {
        'North America': parentRegionId,
        'West Zion': childRegionId,
        'Other Region': otherRegionId,
    };

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiAkaName"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);

        await db
            .insert('RopewikiRegion', [
                {
                    id: parentRegionId,
                    parentRegion: null,
                    name: 'North America',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    pageCount: 0,
                    level: 0,
                    bestMonths: JSON.stringify([]),
                    url: 'https://ropewiki.com/North_America',
                },
                {
                    id: childRegionId,
                    parentRegion: parentRegionId,
                    name: 'West Zion',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    pageCount: 0,
                    level: 1,
                    bestMonths: JSON.stringify([]),
                    url: 'https://ropewiki.com/West_Zion',
                },
                {
                    id: otherRegionId,
                    parentRegion: null,
                    name: 'Other Region',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    pageCount: 0,
                    level: 0,
                    bestMonths: JSON.stringify([]),
                    url: 'https://ropewiki.com/Other_Region',
                },
            ])
            .run(conn);
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "RopewikiAkaName"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiAkaName"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
        await pool.end();
    });

    it('soft-deletes aka names for pages in the given region and descendant regions', async () => {
        const parentPage = RopewikiPage.fromResponseBody(
            {
                printouts: {
                    pageid: ['parent-1'],
                    name: ['Parent Page'],
                    region: [{ fulltext: 'North America' }],
                    url: ['https://ropewiki.com/Parent_Page'],
                    latestRevisionDate: [
                        { timestamp: String(Math.floor(new Date('2025-01-01T00:00:00Z').getTime() / 1000)), raw: '2025-01-01T00:00:00Z' },
                    ],
                },
            },
            regionNameIds,
        );
        const childPage = RopewikiPage.fromResponseBody(
            {
                printouts: {
                    pageid: ['child-1'],
                    name: ['Heaps Canyon'],
                    region: [{ fulltext: 'West Zion' }],
                    url: ['https://ropewiki.com/Heaps_Canyon'],
                    latestRevisionDate: [
                        { timestamp: String(Math.floor(new Date('2025-01-01T00:00:00Z').getTime() / 1000)), raw: '2025-01-01T00:00:00Z' },
                    ],
                },
            },
            regionNameIds,
        );
        const parentRow = await db.insert('RopewikiPage', parentPage.toDbRow()).run(conn);
        const childRow = await db.insert('RopewikiPage', childPage.toDbRow()).run(conn);
        const parentPageId = parentRow.id;
        const childPageId = childRow.id;

        await upsertAkaNames(conn, parentPageId, ['Parent AKA']);
        await upsertAkaNames(conn, childPageId, ['Heaps AKA']);

        const beforeParent = await db.select('RopewikiAkaName', { ropewikiPage: parentPageId }, { columns: ['deletedAt'] }).run(conn);
        const beforeChild = await db.select('RopewikiAkaName', { ropewikiPage: childPageId }, { columns: ['deletedAt'] }).run(conn);
        expect(beforeParent[0]!.deletedAt).toBeNull();
        expect(beforeChild[0]!.deletedAt).toBeNull();

        await setAkaNamesDeletedAtForRegion(conn, parentRegionId);

        const afterParent = await db.select('RopewikiAkaName', { ropewikiPage: parentPageId }, { columns: ['deletedAt'] }).run(conn);
        const afterChild = await db.select('RopewikiAkaName', { ropewikiPage: childPageId }, { columns: ['deletedAt'] }).run(conn);
        expect(afterParent[0]!.deletedAt).not.toBeNull();
        expect(afterChild[0]!.deletedAt).not.toBeNull();
    });

    it('does not soft-delete aka names for pages in other regions', async () => {
        const otherPage = RopewikiPage.fromResponseBody(
            {
                printouts: {
                    pageid: ['other-1'],
                    name: ['Other Page'],
                    region: [{ fulltext: 'Other Region' }],
                    url: ['https://ropewiki.com/Other_Page'],
                    latestRevisionDate: [
                        { timestamp: String(Math.floor(new Date('2025-01-01T00:00:00Z').getTime() / 1000)), raw: '2025-01-01T00:00:00Z' },
                    ],
                },
            },
            regionNameIds,
        );
        const otherRow = await db.insert('RopewikiPage', otherPage.toDbRow()).run(conn);
        const childPage = RopewikiPage.fromResponseBody(
            {
                printouts: {
                    pageid: ['child-2'],
                    name: ['Child Page'],
                    region: [{ fulltext: 'West Zion' }],
                    url: ['https://ropewiki.com/Child_Page'],
                    latestRevisionDate: [
                        { timestamp: String(Math.floor(new Date('2025-01-01T00:00:00Z').getTime() / 1000)), raw: '2025-01-01T00:00:00Z' },
                    ],
                },
            },
            regionNameIds,
        );
        const childRow = await db.insert('RopewikiPage', childPage.toDbRow()).run(conn);
        await upsertAkaNames(conn, otherRow.id, ['Other AKA']);
        await upsertAkaNames(conn, childRow.id, ['Child AKA']);

        await setAkaNamesDeletedAtForRegion(conn, parentRegionId);

        const otherAka = await db.select('RopewikiAkaName', { ropewikiPage: otherRow.id }, { columns: ['deletedAt'] }).run(conn);
        const childAka = await db.select('RopewikiAkaName', { ropewikiPage: childRow.id }, { columns: ['deletedAt'] }).run(conn);
        expect(otherAka[0]!.deletedAt).toBeNull();
        expect(childAka[0]!.deletedAt).not.toBeNull();
    });

    it('does not update aka rows that already have deletedAt set', async () => {
        const page = RopewikiPage.fromResponseBody(
            {
                printouts: {
                    pageid: ['already-deleted'],
                    name: ['Page'],
                    region: [{ fulltext: 'North America' }],
                    url: ['https://ropewiki.com/Page'],
                    latestRevisionDate: [
                        { timestamp: String(Math.floor(new Date('2025-01-01T00:00:00Z').getTime() / 1000)), raw: '2025-01-01T00:00:00Z' },
                    ],
                },
            },
            regionNameIds,
        );
        const row = await db.insert('RopewikiPage', page.toDbRow()).run(conn);
        await upsertAkaNames(conn, row.id, ['Name']);
        const oldDeletedAt = new Date('2025-01-01T10:00:00Z');
        await db.update('RopewikiAkaName', { deletedAt: oldDeletedAt }, { ropewikiPage: row.id, name: 'Name' }).run(conn);

        await new Promise((r) => setTimeout(r, 50));
        await setAkaNamesDeletedAtForRegion(conn, parentRegionId);

        const after = await db.select('RopewikiAkaName', { ropewikiPage: row.id }, { columns: ['deletedAt'] }).run(conn);
        expect(after[0]!.deletedAt).not.toBeNull();
        expect(new Date(after[0]!.deletedAt!).getTime()).toBe(oldDeletedAt.getTime());
    });
});
