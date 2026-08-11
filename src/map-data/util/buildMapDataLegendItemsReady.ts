import type { LegendItem } from 'ropegeo-common/models';

/**
 * Initial mapDataLegendItemsReady map for PageZipperJob after a MapData upsert.
 * Empty legend → {}; otherwise each key is ready when relevance will not run,
 * and not ready when relevance will flip keys as it completes.
 */
const buildMapDataLegendItemsReady = (
    legend: Record<string, LegendItem> | undefined,
    processRelevantContext: boolean,
): Record<string, boolean> => {
    const legendKeys = legend != null ? Object.keys(legend) : [];
    const ready = !processRelevantContext;
    return Object.fromEntries(legendKeys.map((key) => [key, ready]));
};

export default buildMapDataLegendItemsReady;
