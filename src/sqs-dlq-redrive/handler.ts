import { getSQSClient } from 'ropegeo-common/helpers';
import { getDlqArns } from './util/getDlqArns';
import { startMoveTaskForDlq } from './sqs/startMoveTaskForDlq';

/**
 * Lambda handler invoked on a schedule (e.g. daily at noon). Starts StartMessageMoveTask for each
 * configured DLQ so messages are redriven to their source queues. Skips DLQs that already have
 * an active move task.
 */
export const handler = async (): Promise<{
    started: number;
    skipped: number;
    errors: number;
}> => {
    const dlqArns = getDlqArns();
    const sqs = getSQSClient();
    let started = 0;
    let skipped = 0;
    let errors = 0;

    for (const arn of dlqArns) {
        const result = await startMoveTaskForDlq(sqs, arn);
        if (result.started) started += 1;
        else if (result.error) errors += 1;
        else skipped += 1;
    }

    console.log(
        `SqsDlqRedrive: ${started} started, ${skipped} skipped (already running), ${errors} errors`,
    );
    return { started, skipped, errors };
};
