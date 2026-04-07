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
 * SQL text expression for ACA effective risk on `RopewikiPage` alias `p`.
 * Matches {@link AcaDifficulty} / `computeEffectiveRisk` in ropegeo-common (technical default floor).
 */
export function sqlAcaEffectiveRiskForPageP(): db.SQL {
    return db.sql`
(CASE
  WHEN TRIM(COALESCE(p."riskRating", '')) = '' THEN
    CASE TRIM(COALESCE(p."technicalRating", ''))
      WHEN '1' THEN 'G'
      WHEN '2' THEN 'PG'
      WHEN '3' THEN 'PG13'
      WHEN '4' THEN 'PG13'
      ELSE NULL
    END
  ELSE
    CASE
      WHEN (
        CASE TRIM(COALESCE(p."technicalRating", ''))
          WHEN '1' THEN 'G'
          WHEN '2' THEN 'PG'
          WHEN '3' THEN 'PG13'
          WHEN '4' THEN 'PG13'
          ELSE NULL
        END
      ) IS NOT NULL
      AND (
        CASE UPPER(TRIM(p."riskRating"))
          WHEN 'G' THEN 0 WHEN 'PG' THEN 1 WHEN 'PG13' THEN 2 WHEN 'R' THEN 3 WHEN 'X' THEN 4 WHEN 'XX' THEN 5
          ELSE NULL
        END
      ) IS NOT NULL
      AND (
        CASE UPPER(TRIM(p."riskRating"))
          WHEN 'G' THEN 0 WHEN 'PG' THEN 1 WHEN 'PG13' THEN 2 WHEN 'R' THEN 3 WHEN 'X' THEN 4 WHEN 'XX' THEN 5
          ELSE NULL
        END
      ) < (
        CASE (
          CASE TRIM(COALESCE(p."technicalRating", ''))
            WHEN '1' THEN 'G'
            WHEN '2' THEN 'PG'
            WHEN '3' THEN 'PG13'
            WHEN '4' THEN 'PG13'
            ELSE NULL
          END
        )
          WHEN 'G' THEN 0 WHEN 'PG' THEN 1 WHEN 'PG13' THEN 2 WHEN 'R' THEN 3 WHEN 'X' THEN 4 WHEN 'XX' THEN 5
          ELSE NULL
        END
      )
      THEN (
        CASE TRIM(COALESCE(p."technicalRating", ''))
          WHEN '1' THEN 'G'
          WHEN '2' THEN 'PG'
          WHEN '3' THEN 'PG13'
          WHEN '4' THEN 'PG13'
          ELSE NULL
        END
      )
      WHEN (
        CASE UPPER(TRIM(p."riskRating"))
          WHEN 'G' THEN 0 WHEN 'PG' THEN 1 WHEN 'PG13' THEN 2 WHEN 'R' THEN 3 WHEN 'X' THEN 4 WHEN 'XX' THEN 5
          ELSE NULL
        END
      ) IS NOT NULL
      THEN UPPER(TRIM(p."riskRating"))
      ELSE NULL
    END
END)`;
}

/**
 * AND … fragments for ACA difficulty on `RopewikiPage` alias `p`.
 * Empty or inactive difficulty returns no extra SQL.
 * Risk axis (`aca-risk-rating` / {@link AcaDifficultyParams.effectiveRisk}) matches **effective** risk
 * (same rules as {@link AcaDifficulty}), not the raw `riskRating` column alone.
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
    if (d.effectiveRisk.length > 0) {
        const upper = d.effectiveRisk.map((x) => x.toUpperCase());
        const effExpr = sqlAcaEffectiveRiskForPageP();
        out = db.sql`${out} AND (${effExpr}) = ANY(${db.param(upper)}::text[])`;
    }
    return out;
}
