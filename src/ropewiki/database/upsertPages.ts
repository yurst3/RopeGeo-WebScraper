import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import RopewikiPage from '../types/page';
import upsertAkaNames from './upsertAkaNames';

// Max rows per upsert to avoid "bind message has N parameter formats but 0 parameters" when
// the parameter list is very large (e.g. in Lambda). PostgreSQL allows up to 65535 params;
// we use a small chunk so each query has well under that and avoids driver/serialization issues.
const UPSERT_PAGE_CHUNK_SIZE = 100;

const UPDATE_COLUMNS = [
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
    'shuttleTime',
    'minOverallTime',
    'maxOverallTime',
    'overallLength',
    'approachLength',
    'approachElevGain',
    'descentLength',
    'descentElevGain',
    'exitLength',
    'exitElevGain',
    'minApproachTime',
    'maxApproachTime',
    'minDescentTime',
    'maxDescentTime',
    'minExitTime',
    'maxExitTime',
    'months',
    'userVotes',
    'latestRevisionDate',
    'updatedAt',
    'deletedAt',
] as const;

// Insert or update RopewikiPages in batch.
// On conflict (same pageId), update the page fields and timestamps, including latestRevisionDate.
const upsertPages = async (
    tx: db.Queryable,
    pages: RopewikiPage[],
): Promise<RopewikiPage[]> => {
    if (pages.length === 0) {
        return [];
    }

    const rows = pages.map((pageInfo) => pageInfo.toDbRow());

    const chunkPromises = [];
    for (let i = 0; i < rows.length; i += UPSERT_PAGE_CHUNK_SIZE) {
        const chunk = rows.slice(i, i + UPSERT_PAGE_CHUNK_SIZE);
        chunkPromises.push(
            db
                .upsert('RopewikiPage', chunk, ['pageId'], {
                    updateColumns: [...UPDATE_COLUMNS],
                })
                .run(tx),
        );
    }
    const chunkResults = await Promise.all(chunkPromises);
    const allResults = chunkResults.flat();

    // Upsert aka names to RopewikiAkaName (one row per name per page)
    await Promise.all(
        allResults.map((row, i) => {
            const page = pages[i]!;
            return upsertAkaNames(tx, row.id!, page.aka);
        }),
    );

    return allResults.map((row: s.RopewikiPage.JSONSelectable, i) => {
        const page = RopewikiPage.fromDbRow(row);
        page.aka = pages[i]!.aka;
        return page;
    });
};

export default upsertPages;
