import { describe, it, expect } from '@jest/globals';
import { routeDisplayName } from '../../../../src/api/getRoutes/util/routeDisplayName';

describe('routeDisplayName', () => {
    it('returns the name unchanged when fewer than two pages are linked', () => {
        expect(routeDisplayName('Bear Creek Canyon', 0)).toBe('Bear Creek Canyon');
        expect(routeDisplayName('Bear Creek Canyon', 1)).toBe('Bear Creek Canyon');
    });

    it('appends (+n) where n is linkedPageCount - 1', () => {
        expect(routeDisplayName('Bear Creek Canyon', 2)).toBe('Bear Creek Canyon (+1)');
        expect(routeDisplayName('Bear Creek Canyon', 5)).toBe('Bear Creek Canyon (+4)');
    });
});
