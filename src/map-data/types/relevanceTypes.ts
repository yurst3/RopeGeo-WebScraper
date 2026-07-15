import type { Context } from '../util/legendContextSchema';
import { DAYS, FEET, HOURS, MILES, MINUTES } from 'ropegeo-common/models';

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

/** Length and time page stat keys included in relevance payloads. */
export const PAGE_STAT_KEYS = [
    'approachLength',
    'descentLength',
    'exitLength',
    'approachElevGain',
    'descentElevGain',
    'exitElevGain',
    'minApproachTime',
    'maxApproachTime',
    'minDescentTime',
    'maxDescentTime',
    'minExitTime',
    'maxExitTime',
    'shuttleTime',
] as const;

export type PageStatKey = (typeof PAGE_STAT_KEYS)[number];

/** Standard LengthMeasurement and TimeMeasurement unit names from ropegeo-common. */
export const MEASUREMENT_UNIT_NAMES = [
    FEET.name,
    MILES.name,
    'meters',
    'kilometers',
    MINUTES.name,
    HOURS.name,
    DAYS.name,
] as const;

export type MeasurementUnitName = (typeof MEASUREMENT_UNIT_NAMES)[number];

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

/** One per-legend-item failure stored on MapDataRelevantContextJob.errors. */
export type RelevanceJobError = {
    pageName: string;
    legendItemId: string;
    legendItemName: string;
    message: string;
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
