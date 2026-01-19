import * as db from 'zapatos/db';
import { RopewikiImage } from '../types/page';

// Insert or update images for a page.
// On conflict (same ropewikiPage, betaSection & fileUrl), update the image fields and timestamps, including latestRevisionDate.
// Returns an array of image IDs that were upserted.
const upsertImages = async (
    tx: db.Queryable,
    pageUuid: string,
    images: RopewikiImage[],
    betaTitleIds: { [title: string]: string },
    latestRevisionDate: Date,
): Promise<string[]> => {
    if (images.length === 0) return [];

    const now = new Date();

    const rows = images.map((image) => {
        if (image.betaSectionTitle && !betaTitleIds[image.betaSectionTitle]) throw new Error(`No id given for ${image.betaSectionTitle} title`);
        return {
            ropewikiPage: pageUuid,
            betaSection: image.betaSectionTitle ? betaTitleIds[image.betaSectionTitle] ?? null : null,
            linkUrl: image.linkUrl,
            fileUrl: image.fileUrl,
            caption: image.caption ?? null,
            order: image.order,
            latestRevisionDate,
            updatedAt: now,
            deletedAt: null,
        }
    });

    const result = await db
        .upsert('RopewikiImage', rows, ['ropewikiPage', 'betaSection', 'fileUrl'], {
            updateColumns: ['linkUrl', 'caption', 'betaSection', 'order', 'latestRevisionDate', 'updatedAt', 'deletedAt'],
        })
        .run(tx);

    return result.map(row => row.id as string);
};

export default upsertImages;

