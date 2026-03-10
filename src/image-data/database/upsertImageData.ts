import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import ImageData from '../types/imageData';

/**
 * Insert or update an ImageData record. ON CONFLICT (id) DO UPDATE.
 * When allowUpdates = false on conflict, the update is skipped.
 */
const upsertImageData = async (
    conn: db.Queryable,
    imageData: ImageData,
): Promise<ImageData> => {
    const row = imageData.toDbRow();

    const returned = await db.sql<db.SQL, (s.ImageData.JSONSelectable)[]>`
        INSERT INTO "ImageData" ("id", "previewUrl", "bannerUrl", "fullUrl", "sourceUrl", "errorMessage", "updatedAt", "deletedAt")
        VALUES (
            COALESCE(${db.param(row.id)}::uuid, gen_random_uuid()),
            ${db.param(row.previewUrl)},
            ${db.param(row.bannerUrl)},
            ${db.param(row.fullUrl)},
            ${db.param(row.sourceUrl)},
            ${db.param(row.errorMessage)},
            ${db.param(row.updatedAt)},
            ${db.param(row.deletedAt)}
        )
        ON CONFLICT (id) DO UPDATE SET
            "previewUrl" = EXCLUDED."previewUrl",
            "bannerUrl" = EXCLUDED."bannerUrl",
            "fullUrl" = EXCLUDED."fullUrl",
            "sourceUrl" = EXCLUDED."sourceUrl",
            "errorMessage" = EXCLUDED."errorMessage",
            "updatedAt" = EXCLUDED."updatedAt"
        WHERE "ImageData"."allowUpdates" = true
        RETURNING *
    `.run(conn);

    if (returned.length > 0) return ImageData.fromDbRow(returned[0]!);

    const id = row.id as string | undefined;
    if (id) {
        const existing = await db.selectOne('ImageData', { id }).run(conn);
        if (existing) {
            if (existing.allowUpdates === false) {
                console.warn(`ImageData row ${id} not updated: allowUpdates is false`);
            }
            return ImageData.fromDbRow(existing);
        }
    }
    throw new Error('ImageData insert returned no row');
};

export default upsertImageData;
