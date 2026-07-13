import {
    BetaSectionExcerpt,
    LegendItem,
    LineLegendItem,
    OnlineBetaSection,
    PointLegendItem,
    PolygonLegendItem,
    RelevantContext,
} from 'ropegeo-common/models';

export function enrichRelevantContextExcerpts(
    context: RelevantContext,
    betaSectionById: Map<string, OnlineBetaSection>,
): RelevantContext {
    const enrichedExcerpts: Record<string, BetaSectionExcerpt[]> = {};
    for (const [betaSectionId, excerpts] of Object.entries(context.betaSectionExcerpts)) {
        const section = betaSectionById.get(betaSectionId);
        enrichedExcerpts[betaSectionId] = excerpts.map((excerpt) => {
            if (
                section != null &&
                excerpt.text != null &&
                excerpt.text.length > 0
            ) {
                return section.toExcerpt(excerpt.text, excerpt.confidence);
            }
            return excerpt;
        });
    }
    return new RelevantContext(context.measurements, enrichedExcerpts, context.images);
}

export function attachRelevantContextToLegendItem(
    item: LegendItem,
    relevantContext: RelevantContext | null,
): LegendItem {
    if (item instanceof PointLegendItem) {
        return new PointLegendItem(
            item.id,
            item.name,
            item.coordinates,
            item.icon,
            relevantContext,
        );
    }
    if (item instanceof LineLegendItem) {
        return new LineLegendItem(
            item.id,
            item.name,
            item.bounds,
            item.strokeColor,
            item.strokeWidth,
            relevantContext,
        );
    }
    if (item instanceof PolygonLegendItem) {
        return new PolygonLegendItem(
            item.id,
            item.name,
            item.bounds,
            item.borderColor,
            item.fillColor,
            relevantContext,
        );
    }
    return item;
}

export function attachRelevantContextToLegendRecord(
    legend: Record<string, LegendItem>,
    contextByLegendItemId: Map<string, RelevantContext>,
    betaSectionById: Map<string, OnlineBetaSection>,
): Record<string, LegendItem> {
    const out: Record<string, LegendItem> = {};
    for (const [legendItemId, item] of Object.entries(legend)) {
        const stored = contextByLegendItemId.get(legendItemId);
        if (stored == null) {
            out[legendItemId] = item;
            continue;
        }
        const enriched = enrichRelevantContextExcerpts(stored, betaSectionById);
        out[legendItemId] = attachRelevantContextToLegendItem(item, enriched);
    }
    return out;
}
