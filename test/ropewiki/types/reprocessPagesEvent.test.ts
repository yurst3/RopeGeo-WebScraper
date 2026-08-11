import { describe, it, expect } from '@jest/globals';
import { ReprocessPagesEvent } from '../../../src/ropewiki/types/reprocessPagesEvent';

const SAMPLE_ID = '0827ba8b-27b3-40dc-8385-06f823dbf535';

describe('ReprocessPagesEvent', () => {
    it('defaults remakeDownloadFolders to true and includePageIds to undefined', () => {
        const e = new ReprocessPagesEvent();
        expect(e.remakeDownloadFolders).toBe(true);
        expect(e.includePageIds).toBeUndefined();
        expect(ReprocessPagesEvent.fromLambdaEvent(undefined).remakeDownloadFolders).toBe(true);
    });

    it('fromParsedBody applies remakeDownloadFolders and includePageIds', () => {
        const e = ReprocessPagesEvent.fromParsedBody({
            remakeDownloadFolders: false,
            includePageIds: [SAMPLE_ID],
        });
        expect(e.remakeDownloadFolders).toBe(false);
        expect(e.includePageIds).toEqual([SAMPLE_ID]);
    });

    it('throws when remakeDownloadFolders is not boolean', () => {
        expect(() =>
            ReprocessPagesEvent.fromParsedBody({ remakeDownloadFolders: 'yes' }),
        ).toThrow(/remakeDownloadFolders must be a boolean/);
    });

    it('fromLambdaEvent parses API Gateway-style body', () => {
        const e = ReprocessPagesEvent.fromLambdaEvent({
            body: JSON.stringify({ remakeDownloadFolders: false }),
        });
        expect(e.remakeDownloadFolders).toBe(false);
    });
});
