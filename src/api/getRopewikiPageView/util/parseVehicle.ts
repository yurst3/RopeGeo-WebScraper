import { RopewikiVehicleType } from 'ropegeo-common/models';

const DB_VEHICLE_TO_ROPEWIKI: Readonly<Record<string, RopewikiVehicleType>> = {
    Passenger: RopewikiVehicleType.passenger,
    'High Clearance': RopewikiVehicleType.highClearance,
    '4WD': RopewikiVehicleType.fourWd,
    '4WD - High Clearance': RopewikiVehicleType.fourWdHighClearance,
    '4WD - Very High Clearance': RopewikiVehicleType.fourWdVeryHighClearance,
};

/**
 * Maps a vehicle string from the DB to RopewikiVehicleType, or null if empty/unknown.
 */
function parseVehicle(vehicle: string | null): RopewikiVehicleType | null {
    if (vehicle == null || vehicle === '') return null;
    const normalized = vehicle.trim();
    if (normalized === '') return null;
    return DB_VEHICLE_TO_ROPEWIKI[normalized] ?? null;
}

export default parseVehicle;
