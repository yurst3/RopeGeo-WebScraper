import chunk from 'lodash/chunk';
import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import RopewikiPage from '../types/page';
import upsertAkaNames from './upsertAkaNames';
import { makeUnnestPart } from '../../helpers/makeUnnestPart';

const UPSERT_PAGE_CHUNK_SIZE = 100;

// Insert or update RopewikiPages in batch using raw SQL.
// ON CONFLICT (externalPageId) DO UPDATE SET ... WHERE allowUpdates = true.
// Returns only pages that were actually inserted or updated (locked rows are not returned). Upsert aka names only for those pages.
const upsertPages = async (
    tx: db.Queryable,
    pages: RopewikiPage[],
): Promise<RopewikiPage[]> => {
    if (pages.length === 0) return [];

    const rows = pages.map((p) => p.toDbRow());
    const externalPageIds = pages.map((p) => p.externalPageId);
    const updatedExternalPageIds = new Set<string>();
    const byExternalPageId = new Map<string, s.RopewikiPage.JSONSelectable>();

    const columns = RopewikiPage.getDbInsertColumns();

    for (const rowChunk of chunk(rows, UPSERT_PAGE_CHUNK_SIZE)) {
        const unnestPart = makeUnnestPart(RopewikiPage, rowChunk);

        const returned = await db.sql<db.SQL, (s.RopewikiPage.JSONSelectable)[]>`
            INSERT INTO "RopewikiPage" ( ${db.cols(columns)} )
            SELECT * FROM unnest( ${unnestPart} ) AS t( ${db.cols(columns)} )
            ON CONFLICT ("externalPageId") DO UPDATE SET
                "name" = EXCLUDED."name",
                "region" = EXCLUDED."region",
                "url" = EXCLUDED."url",
                "rating" = EXCLUDED."rating",
                "timeRating" = EXCLUDED."timeRating",
                "kmlUrl" = EXCLUDED."kmlUrl",
                "technicalRating" = EXCLUDED."technicalRating",
                "waterRating" = EXCLUDED."waterRating",
                "riskRating" = EXCLUDED."riskRating",
                "permits" = EXCLUDED."permits",
                "rappelInfo" = EXCLUDED."rappelInfo",
                "rappelCount" = EXCLUDED."rappelCount",
                "vehicle" = EXCLUDED."vehicle",
                "quality" = EXCLUDED."quality",
                "coordinates" = EXCLUDED."coordinates",
                "rappelLongest" = EXCLUDED."rappelLongest",
                "shuttleTime" = EXCLUDED."shuttleTime",
                "minOverallTime" = EXCLUDED."minOverallTime",
                "maxOverallTime" = EXCLUDED."maxOverallTime",
                "overallLength" = EXCLUDED."overallLength",
                "approachLength" = EXCLUDED."approachLength",
                "approachElevGain" = EXCLUDED."approachElevGain",
                "descentLength" = EXCLUDED."descentLength",
                "descentElevGain" = EXCLUDED."descentElevGain",
                "exitLength" = EXCLUDED."exitLength",
                "exitElevGain" = EXCLUDED."exitElevGain",
                "minApproachTime" = EXCLUDED."minApproachTime",
                "maxApproachTime" = EXCLUDED."maxApproachTime",
                "minDescentTime" = EXCLUDED."minDescentTime",
                "maxDescentTime" = EXCLUDED."maxDescentTime",
                "minExitTime" = EXCLUDED."minExitTime",
                "maxExitTime" = EXCLUDED."maxExitTime",
                "months" = EXCLUDED."months",
                "userVotes" = EXCLUDED."userVotes",
                "latestRevisionDate" = EXCLUDED."latestRevisionDate",
                "updatedAt" = EXCLUDED."updatedAt",
                "deletedAt" = EXCLUDED."deletedAt"
            WHERE "RopewikiPage"."allowUpdates" = true
            RETURNING *
        `.run(tx);

        for (const row of returned) {
            byExternalPageId.set(row.externalPageId, row);
            updatedExternalPageIds.add(row.externalPageId);
        }
    }

    const results = pages
        .filter((p) => byExternalPageId.has(p.externalPageId))
        .map((p) => {
            const row = byExternalPageId.get(p.externalPageId)!;
            const page = RopewikiPage.fromDbRow(row);
            page.aka = p.aka;
            return page;
        });

    await Promise.all(
        [...updatedExternalPageIds].map((externalPageId) => {
            const row = byExternalPageId.get(externalPageId)!;
            const page = pages[externalPageIds.indexOf(externalPageId)]!;
            return upsertAkaNames(tx, row.id, page.aka);
        }),
    );

    return results;
};

export default upsertPages;
