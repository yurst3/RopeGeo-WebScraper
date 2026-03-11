import {
    SQSClient,
    StartMessageMoveTaskCommand,
    ListMessageMoveTasksCommand,
} from '@aws-sdk/client-sqs';

/**
 * Starts a message move task for the given DLQ ARN. Only one active move task per queue is allowed;
 * if one is already running, we skip starting another and log.
 */
export async function startMoveTaskForDlq(
    sqs: SQSClient,
    dlqArn: string,
): Promise<{ started: boolean; taskHandle?: string; error?: string }> {
    try {
        const listResult = await sqs.send(
            new ListMessageMoveTasksCommand({ SourceArn: dlqArn }),
        );
        const running = (listResult.Results ?? []).some(
            (r) => r.Status === 'RUNNING',
        );
        if (running) {
            console.log(`DLQ ${dlqArn}: move task already running, skipping`);
            return { started: false };
        }
        const result = await sqs.send(
            new StartMessageMoveTaskCommand({
                SourceArn: dlqArn,
                // Omit DestinationArn so messages redrive to their source queues
            }),
        );
        console.log(
            `DLQ ${dlqArn}: started move task ${result.TaskHandle ?? 'unknown'}`,
        );
        return {
            started: true,
            ...(result.TaskHandle != null && { taskHandle: result.TaskHandle }),
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`DLQ ${dlqArn}: StartMessageMoveTask failed:`, message);
        return { started: false, error: message };
    }
}
