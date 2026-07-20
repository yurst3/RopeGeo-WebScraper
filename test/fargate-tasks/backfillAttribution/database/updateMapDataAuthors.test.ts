import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import { updateMapDataAuthors } from '../../../../src/fargate-tasks/backfillAttribution/database/updateMapDataAuthors';

describe('updateMapDataAuthors (database)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });
    const conn: db.Queryable = pool;
    const mapDataId = 'a4000010-0010-4000-8000-000000000010';

    beforeAll(async () => {
        await db.sql`DELETE FROM "MapData" WHERE id = ${db.param(mapDataId)}::uuid`.run(conn);
        await db
            .insert('MapData', {
                id: mapDataId,
                sourceFileUrl: 'https://ropewiki.com/images/a/b/file.kml',
                authors: null,
            })
            .run(conn);
    });

    afterEach(async () => {
        await db
            .update('MapData', { authors: null }, { id: mapDataId })
            .run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "MapData" WHERE id = ${db.param(mapDataId)}::uuid`.run(conn);
        await pool.end();
    });

    it('writes authors onto MapData', async () => {
        await updateMapDataAuthors(conn, mapDataId, ['Frank', 'Grace']);

        const row = await db.selectExactlyOne('MapData', { id: mapDataId }).run(conn);
        expect(row.authors).toEqual(['Frank', 'Grace']);
    });

    it('can clear authors to null', async () => {
        await updateMapDataAuthors(conn, mapDataId, ['Frank']);
        await updateMapDataAuthors(conn, mapDataId, null);

        const row = await db.selectExactlyOne('MapData', { id: mapDataId }).run(conn);
        expect(row.authors).toBeNull();
    });
});
