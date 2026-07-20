import chunk from 'lodash/chunk';
import sleep from './sleep';

/**
 * Runs `fn` over `items` in parallel batches of `batchSize`, sleeping between batches.
 */
export async function runInBatches<T, R>(
    items: T[],
    batchSize: number,
    fn: (item: T) => Promise<R>,
    delayMsBetweenBatches: number,
): Promise<R[]> {
    const batches = chunk(items, batchSize);
    const results: R[] = [];
    let batchIndex = 0;
    while (batchIndex < batches.length) {
        const batch = batches[batchIndex]!;
        const batchResults = await Promise.all(batch.map((item) => fn(item)));
        results.push(...batchResults);
        batchIndex += 1;
        if (batchIndex < batches.length && delayMsBetweenBatches > 0) {
            await sleep(delayMsBetweenBatches);
        }
    }
    return results;
}

export default runInBatches;
