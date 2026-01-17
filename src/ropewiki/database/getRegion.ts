import * as db from 'zapatos/db';
import { RopewikiRegion } from '../types/region';

// Get a single region by name.
// Returns undefined if no region with that name is found.
const getRegion = async (
    conn: db.Queryable,
    name: string,
): Promise<RopewikiRegion | undefined> => {
    const row = await db
        .selectOne('RopewikiRegion', { name })
        .run(conn);

    if (!row) {
        return undefined;
    }

    return RopewikiRegion.fromDbRow(row);
};

export default getRegion;
