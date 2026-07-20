import { describe, it, expect, jest } from '@jest/globals';
import { runInBatches } from '../../../../src/fargate-tasks/backfillAttribution/util/runInBatches';

jest.mock('../../../../src/fargate-tasks/backfillAttribution/util/sleep', () => ({
    __esModule: true,
    default: jest.fn(() => Promise.resolve()),
    sleep: jest.fn(() => Promise.resolve()),
}));

import sleep from '../../../../src/fargate-tasks/backfillAttribution/util/sleep';

describe('runInBatches', () => {
    it('runs items in parallel batches and sleeps between batches', async () => {
        const order: number[] = [];
        const results = await runInBatches(
            [1, 2, 3, 4, 5],
            2,
            async (n) => {
                order.push(n);
                return n * 10;
            },
            50,
        );

        expect(results).toEqual([10, 20, 30, 40, 50]);
        expect(order).toEqual([1, 2, 3, 4, 5]);
        expect(sleep).toHaveBeenCalledTimes(2);
        expect(sleep).toHaveBeenCalledWith(50);
    });

    it('does not sleep after the last batch', async () => {
        jest.mocked(sleep).mockClear();
        await runInBatches([1, 2], 2, async (n) => n, 50);
        expect(sleep).not.toHaveBeenCalled();
    });
});
