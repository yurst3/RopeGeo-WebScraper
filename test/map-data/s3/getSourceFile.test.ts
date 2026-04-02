import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import getSourceFile from '../../../src/map-data/s3/getSourceFile';
import { getS3Object } from 'ropegeo-common/helpers';

jest.mock('ropegeo-common/helpers', () => ({ __esModule: true, getS3Object: jest.fn() }));

describe('getSourceFile', () => {
    const id = '11111111-1111-1111-1111-111111111111';
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        jest.clearAllMocks();
        originalEnv = process.env;
        process.env = { ...originalEnv, MAP_DATA_BUCKET_NAME: 'test-bucket' };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('returns content when source/{id}.{fileExtension} exists (kml)', async () => {
        const body = '<?xml version="1.0"?><kml></kml>';
        jest.mocked(getS3Object).mockResolvedValue({ body });

        const result = await getSourceFile(id, 'kml');

        expect(result).toBe(body);
        expect(getS3Object).toHaveBeenCalledTimes(1);
        expect(getS3Object).toHaveBeenCalledWith('test-bucket', `source/${id}.kml`);
    });

    it('returns content when source/{id}.{fileExtension} exists (gpx)', async () => {
        const body = '<?xml version="1.0"?><gpx></gpx>';
        jest.mocked(getS3Object).mockResolvedValue({ body });

        const result = await getSourceFile(id, 'gpx');

        expect(result).toBe(body);
        expect(getS3Object).toHaveBeenCalledWith('test-bucket', `source/${id}.gpx`);
    });

    it('returns null when the object does not exist', async () => {
        const noSuchKey = new Error('NoSuchKey');
        (noSuchKey as Error & { name: string }).name = 'NoSuchKey';
        jest.mocked(getS3Object).mockRejectedValue(noSuchKey);

        const result = await getSourceFile(id, 'kml');

        expect(result).toBeNull();
        expect(getS3Object).toHaveBeenCalledTimes(1);
        expect(getS3Object).toHaveBeenCalledWith('test-bucket', `source/${id}.kml`);
    });

    it('throws when MAP_DATA_BUCKET_NAME is not set', async () => {
        delete process.env.MAP_DATA_BUCKET_NAME;

        await expect(getSourceFile(id, 'kml')).rejects.toThrow(
            'MAP_DATA_BUCKET_NAME environment variable is not set',
        );
        expect(getS3Object).not.toHaveBeenCalled();
    });

    it('propagates non-NoSuchKey errors from getS3Object', async () => {
        jest.mocked(getS3Object).mockRejectedValue(new Error('AccessDenied'));

        await expect(getSourceFile(id, 'kml')).rejects.toThrow('AccessDenied');
    });
});
