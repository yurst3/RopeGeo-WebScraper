import * as db from 'zapatos/db';
import { RopewikiImage } from '../types/image';

/**
 * Returns a filtered array of RopewikiImages that need AVIF processing: either
 * processedImage is null, or the processedImage's ImageData.sourceUrl differs from
 * the image's fileUrl (e.g. source URL changed). Only queries the database for
 * rows that have a processedImage set.
 *
 * @param conn - Database connection
 * @param images - RopewikiImages (e.g. from upsertImages)
 * @returns RopewikiImages that should be enqueued for image processing
 */
const filterImagesToProcess = async (
    conn: db.Queryable,
    images: RopewikiImage[],
): Promise<RopewikiImage[]> => {
    if (images.length === 0) return [];

    const processedImageIds = [
        ...new Set(
            images
                .map((img) => img.processedImage)
                .filter((id): id is string => id != null && id !== ''),
        ),
    ];

    if (processedImageIds.length === 0) {
        return images;
    }

    const imageDataRows = await db.sql<
        db.SQL,
        { id: string; sourceUrl: string | null }[]
    >`
        SELECT id, "sourceUrl" FROM "ImageData"
        WHERE id = ANY(${db.param(processedImageIds)}::uuid[])
    `.run(conn);
    const sourceById = new Map(imageDataRows.map((r) => [r.id, r.sourceUrl]));

    return images.filter((img) => {
        if (img.processedImage == null || img.processedImage === '') {
            return true;
        }
        const source = sourceById.get(img.processedImage!);
        return source !== img.fileUrl;
    });
};

export default filterImagesToProcess;
