import { Pool } from 'pg';
import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { describe, it, expect, afterEach, beforeAll, afterAll } from '@jest/globals';
import upsertAkaNames from '../../../src/ropewiki/database/upsertAkaNames';
import setAkaNamesDeletedAtForRegion from '../../../src/ropewiki/database/setAkaNamesDeletedAtForRegion';
import RopewikiPage from '../../../src/ropewiki/types/page';

describe('upsertAkaNames (integration)', () => {
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
    let testPageId: string;

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiAkaName"`.run(conn);
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

        const pageInfo = RopewikiPage.fromResponseBody(
            {
                printouts: {
                    pageid: ['sync-aka-test'],
                    name: ['Sync Aka Test Page'],
                    region: [{ fulltext: 'Test Region' }],
                    url: ['https://ropewiki.com/Sync_Aka_Test'],
                    latestRevisionDate: [
                        { timestamp: String(Math.floor(new Date('2025-01-01T00:00:00Z').getTime() / 1000)), raw: '2025-01-01T00:00:00Z' },
                    ],
                },
            },
            regionNameIds,
        );
        const row = await db.insert('RopewikiPage', pageInfo.toDbRow()).run(conn);
        testPageId = row.id;
    });

    afterEach(async () => {
        await db.sql`
            DELETE FROM "RopewikiAkaName"
            WHERE "ropewikiPage" = ${db.param(testPageId)}
        `.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiAkaName"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
        await pool.end();
    });

    async function getAkaRows(): Promise<s.RopewikiAkaName.Selectable[]> {
        return db
            .select('RopewikiAkaName', { ropewikiPage: testPageId }, { columns: ['id', 'ropewikiPage', 'name', 'deletedAt'], order: { by: 'name', direction: 'ASC' } })
            .run(conn);
    }

    it('inserts one row when given one name', async () => {
        await upsertAkaNames(conn, testPageId, ['Pool Arch Canyon']);

        const rows = await getAkaRows();
        expect(rows).toHaveLength(1);
        expect(rows[0]!.name).toBe('Pool Arch Canyon');
        expect(rows[0]!.ropewikiPage).toBe(testPageId);
        expect(rows[0]!.deletedAt).toBeNull();
    });

    it('inserts multiple rows when given multiple names', async () => {
        await upsertAkaNames(conn, testPageId, ['Name A', 'Name B', 'Name C']);

        const rows = await getAkaRows();
        expect(rows).toHaveLength(3);
        expect(rows.map((r) => r.name)).toEqual(['Name A', 'Name B', 'Name C']);
        expect(rows.every((r) => r.deletedAt === null)).toBe(true);
    });

    it('trims and deduplicates names', async () => {
        await upsertAkaNames(conn, testPageId, ['  Trimmed  ', 'Trimmed', '', '  ', 'Other']);

        const rows = await getAkaRows();
        expect(rows).toHaveLength(2);
        expect(rows.map((r) => r.name).sort()).toEqual(['Other', 'Trimmed']);
    });

    it('restores previously soft-deleted row on ON CONFLICT when called after setAkaNamesDeletedAtForRegion', async () => {
        await upsertAkaNames(conn, testPageId, ['Same', 'Other']);
        await setAkaNamesDeletedAtForRegion(conn, testRegionId);
        const afterSoftDelete = await getAkaRows();
        const sameRow = afterSoftDelete.find((r) => r.name === 'Same');
        expect(sameRow!.deletedAt).not.toBeNull();

        await upsertAkaNames(conn, testPageId, ['Same', 'Another']);

        const rows = await getAkaRows();
        const active = rows.filter((r) => r.deletedAt == null);
        expect(active.map((r) => r.name).sort()).toEqual(['Another', 'Same']);
        const sameAgain = rows.find((r) => r.name === 'Same');
        expect(sameAgain!.deletedAt).toBeNull();
    });

    it('leaves already soft-deleted rows unchanged when upserting only new names', async () => {
        await upsertAkaNames(conn, testPageId, ['ToDelete']);
        await setAkaNamesDeletedAtForRegion(conn, testRegionId);

        await upsertAkaNames(conn, testPageId, ['NewOnly']);

        const rows = await getAkaRows();
        const toDeleteRow = rows.find((r) => r.name === 'ToDelete');
        const newOnlyRow = rows.find((r) => r.name === 'NewOnly');
        expect(toDeleteRow!.deletedAt).not.toBeNull();
        expect(newOnlyRow!.deletedAt).toBeNull();
    });

    it('with empty array inserts nothing and leaves existing rows unchanged', async () => {
        await upsertAkaNames(conn, testPageId, ['A', 'B']);
        await upsertAkaNames(conn, testPageId, []);

        const rows = await getAkaRows();
        expect(rows).toHaveLength(2);
        expect(rows.every((r) => r.deletedAt == null)).toBe(true);
        expect(rows.map((r) => r.name).sort()).toEqual(['A', 'B']);
    });
});
