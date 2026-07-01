import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import { getMapDataForFolderReadiness } from '../../../../src/fargate-tasks/buildDownloadFolders/database/getMapDataForFolderReadiness';

describe('getMapDataForFolderReadiness (database)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });
    const conn: db.Queryable = pool;
    const mapDataId = 'f3000001-0001-4000-8000-000000000001';

    afterEach(async () => {
        await db.sql`DELETE FROM "MapData" WHERE id = ${db.param(mapDataId)}::uuid`.run(conn);
    });

    afterAll(async () => {
        await pool.end();
    });

    it('returns null when MapData does not exist', async () => {
        await expect(
            getMapDataForFolderReadiness(conn, '00000000-0000-4000-8000-000000000099'),
        ).resolves.toBeNull();
    });

    it('returns errorMessage and tileCount for existing MapData', async () => {
        await db
            .insert('MapData', {
                id: mapDataId,
                sourceFileUrl: 'https://example.com/source',
                tileCount: 42,
            })
            .run(conn);

        await expect(getMapDataForFolderReadiness(conn, mapDataId)).resolves.toEqual({
            errorMessage: null,
            tileCount: 42,
        });
    });
});
