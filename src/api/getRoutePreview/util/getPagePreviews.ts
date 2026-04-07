import type * as db from 'zapatos/db';
import type { PagePreview } from 'ropegeo-common/models';
import type { PageRoute } from '../../../types/pageRoute';
import { RopewikiRoute } from '../../../types/pageRoute';
import getRopewikiPagePreview from '../database/getRopewikiPagePreview';

/**
 * Maps each PageRoute to a PagePreview by dispatching to the database function
 * for that route type (e.g. RopewikiRoute → getRopewikiPagePreview).
 * Returns previews in the same order as the input array.
 */
const getPagePreviews = async (
    conn: db.Queryable,
    pageRoutes: PageRoute[],
): Promise<PagePreview[]> => {
    return Promise.all(
        pageRoutes.map((pr) => {
            if (pr instanceof RopewikiRoute) {
                return getRopewikiPagePreview(conn, pr);
            }
            const typeName = pr.constructor?.name ?? 'unknown';
            throw new Error(`Unsupported page route type: ${typeName}`);
        }),
    );
};

export default getPagePreviews;
