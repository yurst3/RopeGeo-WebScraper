import { Pool } from 'pg';
import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import upsertRegions from '../../database/upsertRegions';
import { RopewikiRegion } from '../../types/region';
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
    await upsertRegions(conn, []);

    const rows = await db.select('RopewikiRegion', {}).run(conn);
    expect(rows).toHaveLength(0);
  });

  it('inserts net new regions', async () => {
    const latestRevisionDate = new Date('2024-01-01T00:00:00Z');
    const worldUuid = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
    const africaUuid = 'd1d9139d-38db-433c-b7cd-a28f79331667';
    const regions: RopewikiRegion[] = [
      new RopewikiRegion('World', undefined, 0, 0, undefined, [], false, false, latestRevisionDate, undefined, worldUuid),
      new RopewikiRegion('Africa', 'World', 0, 1, undefined, [], false, false, latestRevisionDate, undefined, africaUuid),
    ];

    await upsertRegions(conn, regions);

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
    expect(africa.parentRegion).toBe('World');
    expect(new Date(africa.latestRevisionDate).toISOString()).toBe(latestRevisionDate.toISOString());
  });

  it('updates existing regions via upsert', async () => {
    const initialRevisionDate = new Date('2024-01-01T00:00:00Z');
    const latestRevisionDate = new Date('2024-02-01T00:00:00Z');

    const id = '555c71d0-49b4-4ec8-80b2-13e8f85527fb';

    // Seed an existing region
    await upsertRegions(
      conn,
      [new RopewikiRegion('World', undefined, 0, 0, undefined, [], false, false, initialRevisionDate, undefined, id)],
    );

    // Update the same region
    await upsertRegions(
      conn,
      [new RopewikiRegion('World Updated', undefined, 0, 0, undefined, [], false, false, latestRevisionDate, undefined, id)],
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
        pageCount: 0,
        level: 0,
        bestMonths: JSON.stringify([]),
        isMajorRegion: false,
        isTopLevelRegion: false,
        url: 'https://ropewiki.com/Deleted_Region',
      })
      .run(conn);

    // Verify deletedAt is set
    const beforeRows = await db.select('RopewikiRegion', { id }).run(conn);
    expect(beforeRows[0]?.deletedAt).not.toBeNull();

    // Upsert the region
    await upsertRegions(
      conn,
      [new RopewikiRegion('Restored Region', undefined, 0, 0, undefined, [], false, false, latestRevisionDate, undefined, id)],
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
      new RopewikiRegion('World', undefined, 0, 0, undefined, [], false, false, latestRevisionDate, undefined, '25062f24-745c-4991-8a7b-1ff73b19054e'),
    ];

    // Use a client with a closed pool to force an error
    const badPool = new Pool({
      user: process.env.TEST_USER,
      password: process.env.TEST_PASS,
      host: process.env.TEST_HOST,
      port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
      database: 'nonexistent_database_for_test_error',
    });

    await expect(upsertRegions(badPool, regions)).rejects.toBeDefined();

    await badPool.end();
  });
});
