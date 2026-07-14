import { describe, it, expect } from '@jest/globals';
import { PageDataSource } from 'ropegeo-common/models';
import RopewikiRoute from '../../src/types/pageRoute';

describe('RopewikiRoute.toMapDataEvent', () => {
    const route = new RopewikiRoute(
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        '33333333-3333-3333-3333-333333333333',
    );

    it('defaults downloadSource true, cleanOutlierPoints false, processRelevantContext true', () => {
        const event = route.toMapDataEvent();
        expect(event.source).toBe(PageDataSource.Ropewiki);
        expect(event.routeId).toBe(route.route);
        expect(event.pageId).toBe(route.page);
        expect(event.mapDataId).toBe(route.mapData);
        expect(event.downloadSource).toBe(true);
        expect(event.cleanOutlierPoints).toBe(false);
        expect(event.processRelevantContext).toBe(true);
    });

    it('passes through downloadSource, cleanOutlierPoints, and processRelevantContext', () => {
        const event = route.toMapDataEvent(false, true, false);
        expect(event.downloadSource).toBe(false);
        expect(event.cleanOutlierPoints).toBe(true);
        expect(event.processRelevantContext).toBe(false);
    });
});
