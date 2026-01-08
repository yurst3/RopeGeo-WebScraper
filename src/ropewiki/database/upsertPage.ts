import * as db from 'zapatos/db';
import RopewikiPageInfo from '../types/ropewiki';

// Insert or update a RopewikiPage.
// On conflict (same pageId), update the page fields and timestamps, including latestRevisionDate.
const upsertPage = async (
    tx: db.Queryable,
    pageInfo: RopewikiPageInfo,
    regionId: string,
): Promise<string> => {

    const now = new Date();

    const row = {
        pageId: pageInfo.pageid,
        name: pageInfo.name,
        region: regionId,
        url: pageInfo.url,
        rating: pageInfo.rating ?? null,
        timeRating: pageInfo.timeRating ?? null,
        kmlUrl: pageInfo.kmlUrl ?? null,
        technicalRating: pageInfo.technicalRating ?? null,
        waterRating: pageInfo.waterRating ?? null,
        riskRating: pageInfo.riskRating ?? null,
        permits: pageInfo.permits ?? null,
        rappelInfo: pageInfo.rappelInfo ?? null,
        rappelCount: pageInfo.rappelCount ?? null,
        vehicle: pageInfo.vehicle ?? null,
        quality: pageInfo.quality ?? null,
        coordinates: pageInfo.coordinates ? JSON.stringify(pageInfo.coordinates) : null,
        rappelLongest: pageInfo.rappelLongest ? JSON.stringify(pageInfo.rappelLongest) : null,
        shuttle: pageInfo.shuttle ? JSON.stringify(pageInfo.shuttle) : null,
        minTime: pageInfo.minTime ? JSON.stringify(pageInfo.minTime) : null,
        maxTime: pageInfo.maxTime ? JSON.stringify(pageInfo.maxTime) : null,
        hike: pageInfo.hike ? JSON.stringify(pageInfo.hike) : null,
        months: pageInfo.months ? JSON.stringify(pageInfo.months) : null,
        aka: pageInfo.aka && pageInfo.aka.length > 0 ? JSON.stringify(pageInfo.aka) : null,
        betaSites: pageInfo.betaSites && pageInfo.betaSites.length > 0 ? JSON.stringify(pageInfo.betaSites) : null,
        userVotes: pageInfo.userVotes ?? null,
        latestRevisionDate: pageInfo.latestRevisionDate,
        updatedAt: now,
        deletedAt: null,
    };

    const result = await db
        .upsert('RopewikiPage', row, ['pageId'], {
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
        })
        .run(tx);

    return result.id;
};

export default upsertPage;

