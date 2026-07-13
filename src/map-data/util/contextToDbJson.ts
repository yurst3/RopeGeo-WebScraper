import type { Context } from './legendContextSchema';
import {
    DAYS,
    FEET,
    HOURS,
    LengthMeasurement,
    MILES,
    MINUTES,
    TimeMeasurement,
} from 'ropegeo-common/models';
import type { MeasurementUnitName } from '../types/relevanceTypes';

const LENGTH_UNIT_NAMES = new Set(['feet', 'miles', 'meters', 'kilometers']);

export type RelevantContextDbJson = {
    measurements: Record<string, unknown>[] | null;
    betaSectionExcerpts: Record<string, { text?: string; confidence: number }[]> | null;
    images: Record<string, { id: string; confidence: number }[]> | null;
};

function lengthUnitForName(unitName: MeasurementUnitName) {
    switch (unitName) {
        case FEET.name:
            return FEET;
        case MILES.name:
            return MILES;
        case 'meters':
            return { measurementSystem: 'Metric' as const, name: 'meters' as const };
        case 'kilometers':
            return { measurementSystem: 'Metric' as const, name: 'kilometers' as const };
        default:
            throw new Error(`Unsupported length unitName: ${unitName}`);
    }
}

function timeUnitForName(unitName: MeasurementUnitName) {
    switch (unitName) {
        case MINUTES.name:
            return MINUTES;
        case HOURS.name:
            return HOURS;
        case DAYS.name:
            return DAYS;
        default:
            throw new Error(`Unsupported time unitName: ${unitName}`);
    }
}

function measurementWireJson(value: number, unitName: MeasurementUnitName): Record<string, unknown> {
    if (LENGTH_UNIT_NAMES.has(unitName)) {
        return new LengthMeasurement(value, lengthUnitForName(unitName)).toJSON();
    }
    return new TimeMeasurement(value, timeUnitForName(unitName)).toJSON();
}

export function contextToDbJson(context: Context): RelevantContextDbJson {
    let measurements: RelevantContextDbJson['measurements'] = null;
    if (context.measurements != null && context.measurements.length > 0) {
        measurements = context.measurements.map((entry) => ({
            label: entry.label,
            measurement: measurementWireJson(entry.value, entry.unitName),
            confidence: entry.confidence,
        }));
    }

    let betaSectionExcerpts: RelevantContextDbJson['betaSectionExcerpts'] = null;
    if (context.betaSectionExcerpts != null && context.betaSectionExcerpts.length > 0) {
        const grouped: Record<string, { text?: string; confidence: number }[]> = {};
        for (const excerpt of context.betaSectionExcerpts) {
            const key = excerpt.id;
            if (!grouped[key]) grouped[key] = [];
            const item: { text?: string; confidence: number } = { confidence: excerpt.confidence };
            if (excerpt.text != null && excerpt.text.length > 0) {
                item.text = excerpt.text;
            }
            grouped[key].push(item);
        }
        betaSectionExcerpts = grouped;
    }

    let images: RelevantContextDbJson['images'] = null;
    if (context.images != null && context.images.length > 0) {
        const grouped: Record<string, { id: string; confidence: number }[]> = {};
        for (const image of context.images) {
            const key = image.betaSectionId ?? '';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push({ id: image.id, confidence: image.confidence });
        }
        images = grouped;
    }

    return { measurements, betaSectionExcerpts, images };
}
