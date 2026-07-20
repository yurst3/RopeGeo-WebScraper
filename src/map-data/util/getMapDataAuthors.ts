import { PageDataSource } from 'ropegeo-common/models';
import { getRopewikiMapDataAuthors } from '../hook-functions/getRopewikiMapDataAuthors';

/**
 * Fetches map-file authors based on the page data source.
 */
const getMapDataAuthors = async (
    pageDataSource: PageDataSource,
    sourceFileUrl: string,
): Promise<string[] | null> => {
    switch (pageDataSource) {
        case PageDataSource.Ropewiki:
            return await getRopewikiMapDataAuthors(sourceFileUrl);
    }
};

export default getMapDataAuthors;
