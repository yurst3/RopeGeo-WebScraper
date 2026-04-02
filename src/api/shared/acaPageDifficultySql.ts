import * as db from 'zapatos/db';
import {
    AcaDifficultyParams,
    PageDataSource,
    type DifficultyParams,
} from 'ropegeo-common/classes';

/** When source allow-list is empty/absent, all sources; otherwise require ropewiki for page rows. */
export function searchAllowsRopewikiPages(source: PageDataSource[] | null): boolean {
    if (source == null || source.length === 0) return true;
    return source.includes(PageDataSource.Ropewiki);
}

/**
 * AND … fragments for ACA difficulty on `RopewikiPage` alias `p`.
 * Empty or inactive difficulty returns no extra SQL.
 */
export function sqlAcaDifficultyOnPage(difficulty: DifficultyParams | null): db.SQL {
    if (difficulty == null || !difficulty.isActive()) {
        return db.sql``;
    }
    if (!(difficulty instanceof AcaDifficultyParams)) {
        throw new Error(
            `Unsupported difficulty params for SQL filter: ${difficulty.difficultyType}`,
        );
    }
    const d = difficulty;
    let out: db.SQL = db.sql``;
    if (d.technical.length > 0) {
        out = db.sql`${out} AND TRIM(p."technicalRating") = ANY(${db.param(d.technical)}::text[])`;
    }
    if (d.water.length > 0) {
        const lower = d.water.map((w) => w.toLowerCase());
        out = db.sql`${out} AND LOWER(TRIM(p."waterRating")) = ANY(${db.param(lower)}::text[])`;
    }
    if (d.time.length > 0) {
        const lower = d.time.map((t) => t.toLowerCase());
        out = db.sql`${out} AND LOWER(TRIM(p."timeRating")) = ANY(${db.param(lower)}::text[])`;
    }
    if (d.risk.length > 0) {
        const upper = d.risk.map((x) => x.toUpperCase());
        out = db.sql`${out} AND UPPER(TRIM(p."riskRating")) = ANY(${db.param(upper)}::text[])`;
    }
    return out;
}
