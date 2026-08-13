import { describe, it, expect } from '@jest/globals';
import { RouteType } from 'ropegeo-common/models';
import { routeFromDbRowWithLinkedPages } from '../../../../src/api/getRoutes/database/routeRowWithLinkedPages';
import type { RouteRowWithLinkedPageCount } from '../../../../src/api/getRoutes/database/routeRowWithLinkedPages';

describe('routeFromDbRowWithLinkedPages', () => {
    const baseRow = {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Shared Canyon',
        type: 'Canyon',
        coordinates: { lat: 40, lon: -111 },
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
        deletedAt: null,
        allowUpdates: true,
    };

    it('appends (+n) when linkedPageCount is a number greater than 1', () => {
        const row = { ...baseRow, linkedPageCount: 3 } as RouteRowWithLinkedPageCount;
        const route = routeFromDbRowWithLinkedPages(row);
        expect(route.name).toBe('Shared Canyon (+2)');
        expect(route.type).toBe(RouteType.Canyon);
    });

    it('parses string linkedPageCount from SQL text results', () => {
        const row = { ...baseRow, linkedPageCount: '2' } as RouteRowWithLinkedPageCount;
        const route = routeFromDbRowWithLinkedPages(row);
        expect(route.name).toBe('Shared Canyon (+1)');
    });

    it('leaves the name unchanged for a single linked page', () => {
        const row = { ...baseRow, linkedPageCount: 1 } as RouteRowWithLinkedPageCount;
        expect(routeFromDbRowWithLinkedPages(row).name).toBe('Shared Canyon');
    });

    it('treats unparsable linkedPageCount as zero', () => {
        const row = { ...baseRow, linkedPageCount: 'not-a-number' } as RouteRowWithLinkedPageCount;
        expect(routeFromDbRowWithLinkedPages(row).name).toBe('Shared Canyon');
    });
});
