import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { RopewikiImage } from '../types/image';
import { makeUnnestPart } from '../../helpers/makeUnnestPart';

// Insert or update images for a page.
// ON CONFLICT (ropewikiPage, betaSection, fileUrl) DO UPDATE SET ... WHERE allowUpdates = true.
// Returns image IDs only for images that were actually inserted or updated (locked rows are not included), in input order.
const upsertImages = async (
    tx: db.Queryable,
    pageUuid: string,
    images: RopewikiImage[],
    betaTitleIds: { [title: string]: string },
    latestRevisionDate: Date,
): Promise<string[]> => {
    if (images.length === 0) return [];

    const columns = RopewikiImage.getDbInsertColumns();
    const rows = images.map((img) => img.toDbRow(pageUuid, betaTitleIds, latestRevisionDate));
    const unnestPart = makeUnnestPart(RopewikiImage, rows);

    const key = (r: { ropewikiPage: string; betaSection: string | null; fileUrl: string }) =>
        `${r.ropewikiPage}\0${r.betaSection ?? ''}\0${r.fileUrl}`;

    const returned = await db.sql<
        db.SQL,
        (s.RopewikiImage.JSONSelectable)[]
    >`
        INSERT INTO "RopewikiImage" ( ${db.cols(columns)} )
        SELECT * FROM unnest( ${unnestPart} ) AS t( ${db.cols(columns)} )
        ON CONFLICT ("ropewikiPage", "betaSection", "fileUrl") DO UPDATE SET
            "linkUrl" = EXCLUDED."linkUrl",
            "caption" = EXCLUDED."caption",
            "betaSection" = EXCLUDED."betaSection",
            "order" = EXCLUDED."order",
            "latestRevisionDate" = EXCLUDED."latestRevisionDate",
            "updatedAt" = EXCLUDED."updatedAt",
            "deletedAt" = EXCLUDED."deletedAt"
        WHERE "RopewikiImage"."allowUpdates" = true
        RETURNING id, "ropewikiPage", "betaSection", "fileUrl"
    `.run(tx);

    const byKey = new Map(
        returned.map((row) => [
            key({ ropewikiPage: row.ropewikiPage, betaSection: row.betaSection ?? null, fileUrl: row.fileUrl }),
            row.id,
        ]),
    );
    return rows.filter((r) => byKey.has(key(r))).map((r) => byKey.get(key(r))!);
};

export default upsertImages;
