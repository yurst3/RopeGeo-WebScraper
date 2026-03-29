import getS3Object from 'ropegeo-common/helpers/s3/getS3Object';

function isNoSuchKeyError(err: unknown): boolean {
    return err instanceof Error && (err as Error & { name?: string }).name === 'NoSuchKey';
}

/**
 * Fetches the source file for the given map data id and file extension from S3.
 *
 * @param id - Map data UUID
 * @param fileExtension - File extension (e.g. 'kml' or 'gpx'); appended to id to form the key source/{id}.{fileExtension}
 * @returns The file content, or null if the object does not exist
 * @throws Error if MAP_DATA_BUCKET_NAME is not set, or for S3 errors other than NoSuchKey
 */
const getSourceFile = async (id: string, fileExtension: string): Promise<string | null> => {
    const bucket = process.env.MAP_DATA_BUCKET_NAME;
    if (!bucket) {
        throw new Error('MAP_DATA_BUCKET_NAME environment variable is not set');
    }

    const key = `source/${id}.${fileExtension}`;
    try {
        const { body } = await getS3Object(bucket, key);
        return body;
    } catch (err) {
        if (!isNoSuchKeyError(err)) {
            throw err;
        }
        return null;
    }
};

export default getSourceFile;
