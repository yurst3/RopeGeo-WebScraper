import type { Context } from '../util/legendContextSchema';
import { MEASUREMENT_KEYS, type MeasurementKey } from 'ropegeo-common/models';

export type ModelConfig = {
    gatewayModel: string;
    inputPricePerMillion: number;
    outputPricePerMillion: number;
};

export type PageMatch = {
    id: string;
    name: string;
    similarityScore: number;
};

export type LegendItemInput = {
    id: string;
    featureType: 'point' | 'line' | 'polygon';
    name: string;
};

export type BetaSectionInput = {
    id: string;
    title: string;
    text: string;
    order: number | null;
};

export type ImageInput = {
    id: string;
    betaSectionId: string | null;
    betaSectionTitle: string | null;
    caption: string | null;
    order: number | null;
};

export function imageHasCaption(caption: string | null): caption is string {
    return caption != null && caption.trim().length > 0;
}

/** Length and time page-stat keys included in relevance payloads (alias of MEASUREMENT_KEYS). */
export const PAGE_STAT_KEYS = MEASUREMENT_KEYS;
export type PageStatKey = MeasurementKey;

export type PageStatsInput = Partial<Record<PageStatKey, unknown>>;

export type PageRelevanceInput = {
    page: {
        id: string;
        name: string;
        url: string;
    };
    mapDataId: string | null;
    legendItems: LegendItemInput[];
    betaSections: BetaSectionInput[];
    images: ImageInput[];
    pageStats: PageStatsInput;
};

export type TokenUsage = {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
};

export type ModelRunResult = {
    response: Context;
    usage: TokenUsage;
    durationMs: number;
    estimatedCostUsd: number;
};

export type LegendItemContextResult = {
    legendItem: LegendItemInput;
    context: Context;
};

/** One per-legend-item failure stored in MapDataRelevantContextError. */
export type RelevanceJobError = {
    legendItemId: string;
    input: string;
    errorMessage: string;
};

export type RelevanceJobResult =
    | {
          status: 'complete';
          processedCount: number;
          skippedCount: number;
      }
    | {
          status: 'partial';
          processedCount: number;
          skippedCount: number;
          remainingCount: number;
      }
    | {
          status: 'failed';
          errors: RelevanceJobError[];
          processedCount: number;
          skippedCount: number;
      }
    | {
          status: 'missing_job';
      };
