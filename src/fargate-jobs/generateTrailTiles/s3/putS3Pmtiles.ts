import putS3Object from '../../../helpers/s3/putS3Object';

export const S3_KEY = 'pmtiles/trails.pmtiles';
export const PMTILES_CONTENT_TYPE = 'application/vnd.pmtiles';

/**
 * Uploads the pmtiles body to S3 at the trails key.
 */
export async function putS3Pmtiles(body: Buffer, bucket: string): Promise<void> {
    await putS3Object(bucket, S3_KEY, body, PMTILES_CONTENT_TYPE);
    console.log(`Uploaded ${S3_KEY} to s3://${bucket}/${S3_KEY}`);
}
