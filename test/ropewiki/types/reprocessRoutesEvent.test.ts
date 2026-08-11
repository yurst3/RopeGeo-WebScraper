import { describe, it, expect } from '@jest/globals';
import { ReprocessRoutesEvent } from '../../../src/ropewiki/types/reprocessRoutesEvent';

describe('ReprocessRoutesEvent', () => {
    it('defaults remakeDownloadFolders to true', () => {
        expect(new ReprocessRoutesEvent().remakeDownloadFolders).toBe(true);
        expect(ReprocessRoutesEvent.fromLambdaEvent(undefined).remakeDownloadFolders).toBe(true);
    });

    it('fromParsedBody applies remakeDownloadFolders', () => {
        expect(
            ReprocessRoutesEvent.fromParsedBody({ remakeDownloadFolders: false })
                .remakeDownloadFolders,
        ).toBe(false);
    });

    it('throws when remakeDownloadFolders is not boolean', () => {
        expect(() =>
            ReprocessRoutesEvent.fromParsedBody({ remakeDownloadFolders: 1 }),
        ).toThrow(/remakeDownloadFolders must be a boolean/);
    });

    it('fromLambdaEvent parses root payload for direct invoke', () => {
        expect(
            ReprocessRoutesEvent.fromLambdaEvent({ remakeDownloadFolders: false })
                .remakeDownloadFolders,
        ).toBe(false);
    });
});
