import { describe, it, expect, beforeEach } from '@jest/globals';
import { getDlqArns, ENV_DLQ_ARNS } from '../../../src/sqs-dlq-redrive/util/getDlqArns';

describe('getDlqArns', () => {
    beforeEach(() => {
        delete process.env[ENV_DLQ_ARNS];
    });

    it('throws when SQS_DLQ_ARNS is not set', () => {
        expect(() => getDlqArns()).toThrow(
            'SQS_DLQ_ARNS must be set (comma-separated DLQ ARNs)',
        );
    });

    it('throws when SQS_DLQ_ARNS is empty string', () => {
        process.env[ENV_DLQ_ARNS] = '';
        expect(() => getDlqArns()).toThrow(
            'SQS_DLQ_ARNS must be set (comma-separated DLQ ARNs)',
        );
    });

    it('returns single ARN as single-element array', () => {
        const arn = 'arn:aws:sqs:us-east-1:123:my-dlq';
        process.env[ENV_DLQ_ARNS] = arn;
        expect(getDlqArns()).toEqual([arn]);
    });

    it('returns multiple ARNs split by comma', () => {
        const arn1 = 'arn:aws:sqs:us-east-1:123:dlq1';
        const arn2 = 'arn:aws:sqs:us-east-1:123:dlq2';
        process.env[ENV_DLQ_ARNS] = `${arn1},${arn2}`;
        expect(getDlqArns()).toEqual([arn1, arn2]);
    });

    it('trims whitespace around each ARN', () => {
        const arn1 = 'arn:aws:sqs:us-east-1:123:dlq1';
        const arn2 = 'arn:aws:sqs:us-east-1:123:dlq2';
        process.env[ENV_DLQ_ARNS] = `  ${arn1}  ,  ${arn2}  `;
        expect(getDlqArns()).toEqual([arn1, arn2]);
    });

    it('filters out empty segments', () => {
        const arn = 'arn:aws:sqs:us-east-1:123:dlq';
        process.env[ENV_DLQ_ARNS] = `,${arn},,`;
        expect(getDlqArns()).toEqual([arn]);
    });
});
