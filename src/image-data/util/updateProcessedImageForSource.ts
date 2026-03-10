import * as db from 'zapatos/db';
import { PageDataSource } from 'ropegeo-common';
import updateProcessedImage from '../../ropewiki/database/updateProcessedImage';

const updateProcessedRopewikiImage = updateProcessedImage;

/**
 * Updates the processedImage column for the row identified by pageDataSource and id.
 * For Ropewiki, updates RopewikiImage.processedImage where id = rowId.
 *
 * @param conn - Database connection
 * @param pageDataSource - Source of the row (e.g. PageDataSource.Ropewiki)
 * @param rowId - Primary key of the row to update
 * @param imageDataId - ImageData id to set as processedImage
 */
const updateProcessedImageForSource = async (
    conn: db.Queryable,
    pageDataSource: PageDataSource,
    rowId: string,
    imageDataId: string,
): Promise<void> => {
    switch (pageDataSource) {
        case PageDataSource.Ropewiki: {
            await updateProcessedRopewikiImage(conn, rowId, imageDataId);
            return;
        }
        default: {
            throw new Error(
                `updateProcessedImageForSource: unsupported pageDataSource ${pageDataSource}`,
            );
        }
    }
};

export default updateProcessedImageForSource;
