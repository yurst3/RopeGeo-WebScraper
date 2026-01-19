import * as db from 'zapatos/db';
import RopewikiPage from '../types/page';

// Insert or update RopewikiPages in batch.
// On conflict (same pageId), update the page fields and timestamps, including latestRevisionDate.
const upsertPages = async (
    tx: db.Queryable,
    pages: RopewikiPage[],
): Promise<RopewikiPage[]> => {
    if (pages.length === 0) {
        return [];
    }

    const rows = pages.map(pageInfo => pageInfo.toDbRow());

    const results = await db.upsert('RopewikiPage', rows, ['pageId'], {
        updateColumns: [
            'name',
            'region',
            'url',
            'rating',
            'timeRating',
            'kmlUrl',
            'technicalRating',
            'waterRating',
            'riskRating',
            'permits',
            'rappelInfo',
            'rappelCount',
            'vehicle',
            'quality',
            'coordinates',
            'rappelLongest',
            'shuttle',
            'minTime',
            'maxTime',
            'hike',
            'months',
            'aka',
            'betaSites',
            'userVotes',
            'latestRevisionDate',
            'updatedAt',
            'deletedAt',
        ],
    }).run(tx)

    return results.map(row => RopewikiPage.fromDbRow(row));
};

export default upsertPages;
