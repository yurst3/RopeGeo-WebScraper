import getChildRegions from "./database/getChildRegions";
import getRegionCounts from "./http/getRegionCounts";
import { Queryable } from "zapatos/db";

const underLimit = (counts: {[name: string]: number}, limit: number): boolean => {
    return Object.values(counts).every(count => count <= limit);
}

/*
Gets the regions counts for all regions with a count less than or equal to a certain limit.
If there are regions with counts that exceed the limit, get the children of those regions the children's counts unti all are less than or equal to the limt.
*/
const getRegionCountsUnderLimit = async (conn: Queryable, rootRegionName: string, limit: number): Promise<{[name: string]: number}> => {
    if (limit <= 0) throw new Error('Limit must be greater than 0');
    let counts: {[name: string]: number} = await getRegionCounts([rootRegionName]);

    while (!underLimit(counts, limit)) {
        const overLimitNames = Object.keys(counts).filter(name => counts[name] as number > limit);
        const underLimitCounts:  {[name: string]: number} = Object.fromEntries(
            Object.entries(counts).filter(([, count]) => count <= limit)
        );

        const overLimitChildren: string[][] = await Promise.all(overLimitNames.map(name => getChildRegions(conn, name)));
        if (overLimitChildren.some(childNames => !childNames.length)) throw new Error(`A region without any children exceeds the limit of ${limit}`);
        const overLimitChildCounts: {[name: string]: number}[] = [];

        for (const overLimitChildNames of overLimitChildren) {
            overLimitChildCounts.push(await getRegionCounts(overLimitChildNames));
        }

        counts = Object.assign(underLimitCounts, ...overLimitChildCounts);
    }

    return counts;
}

export default getRegionCountsUnderLimit;