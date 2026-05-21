import { describe, it, expect } from '@jest/globals';
import { RopewikiVehicleType } from 'ropegeo-common/models';
import parseVehicle from '../../../../src/api/getRopewikiPageView/util/parseVehicle';

describe('parseVehicle', () => {
    it('returns null when vehicle is null', () => {
        expect(parseVehicle(null)).toBeNull();
    });

    it('returns null when vehicle is empty string', () => {
        expect(parseVehicle('')).toBeNull();
    });

    it('returns RopewikiVehicleType for known DB values', () => {
        expect(parseVehicle('Passenger')).toBe(RopewikiVehicleType.passenger);
        expect(parseVehicle('High Clearance')).toBe(RopewikiVehicleType.highClearance);
        expect(parseVehicle('4WD')).toBe(RopewikiVehicleType.fourWd);
        expect(parseVehicle('4WD - High Clearance')).toBe(
            RopewikiVehicleType.fourWdHighClearance,
        );
        expect(parseVehicle('4WD - Very High Clearance')).toBe(
            RopewikiVehicleType.fourWdVeryHighClearance,
        );
    });

    it('trims whitespace before matching', () => {
        expect(parseVehicle('  Passenger  ')).toBe(RopewikiVehicleType.passenger);
        expect(parseVehicle('\t4WD\n')).toBe(RopewikiVehicleType.fourWd);
    });

    it('returns null for unknown value', () => {
        expect(parseVehicle('SUV')).toBeNull();
        expect(parseVehicle('passenger')).toBeNull();
    });
});
