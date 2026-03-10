import * as db from 'zapatos/db';

/**
 * Updates RopewikiImage.processedImage for the row with the given id.
 *
 * @param conn - Database connection
 * @param rowId - RopewikiImage id to update
 * @param imageDataId - ImageData id to set as processedImage
 */
const updateProcessedImage = async (
    conn: db.Queryable,
    rowId: string,
    imageDataId: string,
): Promise<void> => {
    await db.update('RopewikiImage', { processedImage: imageDataId }, { id: rowId }).run(conn);
};

export default updateProcessedImage;
