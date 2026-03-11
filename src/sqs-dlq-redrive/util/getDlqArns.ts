export const ENV_DLQ_ARNS = 'SQS_DLQ_ARNS';

/**
 * Parses SQS_DLQ_ARNS env (comma-separated ARNs) and returns non-empty trimmed ARNs.
 */
export function getDlqArns(): string[] {
    const raw = process.env[ENV_DLQ_ARNS];
    if (!raw || typeof raw !== 'string') {
        throw new Error(
            `${ENV_DLQ_ARNS} must be set (comma-separated DLQ ARNs)`,
        );
    }
    return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}
