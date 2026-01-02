import { Pool } from 'pg';
import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import upsertRegions from '../../database/upsertRegions';
import type { RopewikiRegion } from '../../types/ropewiki';
import { describe, it, expect, afterEach, beforeAll, afterAll } from '@jest/globals';

describe('upsertRegions (integration)', () => {
  const pool = new Pool({
    user: process.env.TEST_USER,
    password: process.env.TEST_PASS,
    host: process.env.TEST_HOST,
    port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
    database: process.env.TEST_DB,
  });

  const conn: db.Queryable = pool;

  beforeAll(async () => {
    // Ensure the table exists and is empty for tests
    await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
  });

  afterEach(async () => {
    // Clean up between tests
    await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('does nothing when regions array is empty', async () => {
    const latestRevisionDate = new Date('2024-01-01T00:00:00Z');

    await upsertRegions(conn, [], latestRevisionDate);

    const rows = await db.select('RopewikiRegion', {}).run(conn);
    expect(rows).toHaveLength(0);
  });

  it('inserts net new regions', async () => {
    const latestRevisionDate = new Date('2024-01-01T00:00:00Z');
    const worldUuid = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
    const africaUuid = 'd1d9139d-38db-433c-b7cd-a28f79331667';
    const regions: RopewikiRegion[] = [
      { id: worldUuid, name: 'World', parentRegion: undefined },
      { id: africaUuid, name: 'Africa', parentRegion: worldUuid },
    ];

    await upsertRegions(conn, regions, latestRevisionDate);

    const rows = await db
      .select('RopewikiRegion', {}, { order: { by: 'name', direction: 'ASC' } })
      .run(conn);

    expect(rows).toHaveLength(2);

    const world = rows.find((r) => r.id === worldUuid) as s.RopewikiRegion.JSONSelectable;
    const africa = rows.find((r) => r.id === africaUuid) as s.RopewikiRegion.JSONSelectable;

    expect(world.name).toBe('World');
    expect(world.parentRegion).toBeNull();
    expect(new Date(world.latestRevisionDate).toISOString()).toBe(latestRevisionDate.toISOString());

    expect(africa.name).toBe('Africa');
    expect(africa.parentRegion).toBe(worldUuid);
    expect(new Date(africa.latestRevisionDate).toISOString()).toBe(latestRevisionDate.toISOString());
  });

  it('updates existing regions via upsert', async () => {
    const initialRevisionDate = new Date('2024-01-01T00:00:00Z');
    const latestRevisionDate = new Date('2024-02-01T00:00:00Z');

    const id = '555c71d0-49b4-4ec8-80b2-13e8f85527fb';

    // Seed an existing region
    await upsertRegions(
      conn,
      [{ id, name: 'World', parentRegion: undefined }],
      initialRevisionDate,
    );

    // Update the same region
    await upsertRegions(
      conn,
      [{ id, name: 'World Updated', parentRegion: undefined }],
      latestRevisionDate,
    );

    const rows = await db.select('RopewikiRegion', { id }).run(conn);
    expect(rows).toHaveLength(1);

    const region = rows[0] as s.RopewikiRegion.JSONSelectable;
    expect(region.name).toBe('World Updated');
    expect(region.parentRegion).toBeNull();
    expect(new Date(region.latestRevisionDate).toISOString()).toBe(
      latestRevisionDate.toISOString(),
    );
  });

  it('sets deletedAt to null when upserting', async () => {
    const latestRevisionDate = new Date('2024-01-01T00:00:00Z');
    const id = '88888888-8888-8888-8888-888888888888';

    // Insert a region with deletedAt set
    await db
      .insert('RopewikiRegion', {
        id,
        name: 'Deleted Region',
        parentRegion: null,
        latestRevisionDate: '2024-01-01T00:00:00' as db.TimestampString,
        deletedAt: '2024-01-01T00:00:00' as db.TimestampString,
      })
      .run(conn);

    // Verify deletedAt is set
    const beforeRows = await db.select('RopewikiRegion', { id }).run(conn);
    expect(beforeRows[0]?.deletedAt).not.toBeNull();

    // Upsert the region
    await upsertRegions(
      conn,
      [{ id, name: 'Restored Region', parentRegion: undefined }],
      latestRevisionDate,
    );

    // Verify deletedAt is now null
    const afterRows = await db.select('RopewikiRegion', { id }).run(conn);
    expect(afterRows).toHaveLength(1);
    const region = afterRows[0] as s.RopewikiRegion.JSONSelectable;
    expect(region.deletedAt).toBeNull();
    expect(region.name).toBe('Restored Region');
  });

  it('propagates errors from the database layer', async () => {
    const latestRevisionDate = new Date('2024-03-01T00:00:00Z');
    const regions: RopewikiRegion[] = [
      { id: '25062f24-745c-4991-8a7b-1ff73b19054e', name: 'World', parentRegion: undefined },
    ];

    // Use a client with a closed pool to force an error
    const badPool = new Pool({
      user: process.env.TEST_USER,
      password: process.env.TEST_PASS,
      host: process.env.TEST_HOST,
      port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
      database: 'nonexistent_database_for_test_error',
    });

    await expect(upsertRegions(badPool, regions, latestRevisionDate)).rejects.toBeDefined();

    await badPool.end();
  });
});
