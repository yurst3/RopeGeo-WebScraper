import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import { getMapDataNeedingAuthors } from '../../../../src/fargate-tasks/backfillAttribution/database/getMapDataNeedingAuthors';

describe('getMapDataNeedingAuthors (database)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });
    const conn: db.Queryable = pool;
    const needingId = 'a4000001-0001-4000-8000-000000000001';
    const hasAuthorsId = 'a4000002-0002-4000-8000-000000000002';
    const emptyUrlId = 'a4000003-0003-4000-8000-000000000003';
    const deletedId = 'a4000004-0004-4000-8000-000000000004';

    beforeAll(async () => {
        await db.sql`DELETE FROM "MapData" WHERE id IN (${db.vals([needingId, hasAuthorsId, emptyUrlId, deletedId])})`.run(conn);
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "MapData" WHERE id IN (${db.vals([needingId, hasAuthorsId, emptyUrlId, deletedId])})`.run(conn);
    });

    afterAll(async () => {
        await pool.end();
    });

    it('returns only non-deleted rows with null authors and non-empty sourceFileUrl', async () => {
        await db
            .insert('MapData', [
                {
                    id: needingId,
                    sourceFileUrl: 'https://ropewiki.com/images/a/b/file.kml',
                    authors: null,
                },
                {
                    id: hasAuthorsId,
                    sourceFileUrl: 'https://ropewiki.com/images/a/b/has.kml',
                    authors: ['Eve'],
                },
                {
                    id: emptyUrlId,
                    sourceFileUrl: '',
                    authors: null,
                },
                {
                    id: deletedId,
                    sourceFileUrl: 'https://ropewiki.com/images/a/b/del.kml',
                    authors: null,
                    deletedAt: new Date(),
                },
            ])
            .run(conn);

        const rows = await getMapDataNeedingAuthors(conn);
        const ids = rows.map((r) => r.id);
        expect(ids).toContain(needingId);
        expect(ids).not.toContain(hasAuthorsId);
        expect(ids).not.toContain(emptyUrlId);
        expect(ids).not.toContain(deletedId);
    });
});
