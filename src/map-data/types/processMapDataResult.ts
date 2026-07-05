import type { LegendItem } from 'ropegeo-common/models';
import type MapData from './mapData';

export type ProcessMapDataResult = {
    mapData: MapData;
    legend?: Record<string, LegendItem>;
};
