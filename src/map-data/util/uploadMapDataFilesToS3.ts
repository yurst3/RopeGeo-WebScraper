import { readFile } from 'fs/promises';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

/**
 * Uploads map data files (source, GeoJSON, and vector tiles) to S3.
 * Only uploads if running in a Lambda environment, otherwise logs that it's skipping.
 * 
 * @param sourceFilePath - Path to the source file (KML or GPX)
 * @param geoJsonFilePath - Path to the GeoJSON file
 * @param vectorTileFilePath - Path to the vector tile file (MBTiles)
 * @param mapDataId - UUID for the map data (used in S3 keys)
 * @param isKml - Whether the source file is KML (true) or GPX (false)
 * @returns Promise that resolves to an object with S3 URLs for all three files
 */
export const uploadMapDataFilesToS3 = async (
    sourceFilePath: string,
    geoJsonFilePath: string,
    vectorTileFilePath: string,
    mapDataId: string,
    isKml: boolean,
): Promise<{
    sourceS3Url: string;
    geoJsonS3Url: string;
    vectorTileS3Url: string;
}> => {
    const bucketName = process.env.MAP_DATA_BUCKET_NAME;
    if (!bucketName) {
        throw new Error('MAP_DATA_BUCKET_NAME environment variable is not set');
    }

    // Check if running in Lambda environment
    const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.LAMBDA_TASK_ROOT;

    if (!isLambda) {
        console.log('Skipping S3 upload - not running in Lambda environment');
        // Return placeholder URLs for local development
        return {
            sourceS3Url: `local://${sourceFilePath}`,
            geoJsonS3Url: `local://${geoJsonFilePath}`,
            vectorTileS3Url: `local://${vectorTileFilePath}`,
        };
    }

    // Upload files to S3
    console.log('Uploading files to S3...');
    const s3Client = new S3Client({});

    const fileExtension = isKml ? 'kml' : 'gpx';
    const sourceFileName = `${mapDataId}.${fileExtension}`;
    const geoJsonFileName = `${mapDataId}.geojson`;
    const vectorTileFileName = `${mapDataId}.mbtiles`;

    // Upload source file
    const sourceS3Key = `source/${sourceFileName}`;
    const sourceFileBuffer = await readFile(sourceFilePath);
    await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: sourceS3Key,
        Body: sourceFileBuffer,
        ContentType: isKml ? 'application/vnd.google-earth.kml+xml' : 'application/gpx+xml',
    }));
    const sourceS3Url = `https://${bucketName}.s3.amazonaws.com/${sourceS3Key}`;

    // Upload GeoJSON file
    const geoJsonS3Key = `geojson/${geoJsonFileName}`;
    const geoJsonFileBuffer = await readFile(geoJsonFilePath);
    await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: geoJsonS3Key,
        Body: geoJsonFileBuffer,
        ContentType: 'application/geo+json',
    }));
    const geoJsonS3Url = `https://${bucketName}.s3.amazonaws.com/${geoJsonS3Key}`;

    // Upload vector tile file
    const vectorTileS3Key = `vector-tiles/${vectorTileFileName}`;
    const vectorTileFileBuffer = await readFile(vectorTileFilePath);
    await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: vectorTileS3Key,
        Body: vectorTileFileBuffer,
        ContentType: 'application/x-protobuf',
    }));
    const vectorTileS3Url = `https://${bucketName}.s3.amazonaws.com/${vectorTileS3Key}`;

    return {
        sourceS3Url,
        geoJsonS3Url,
        vectorTileS3Url,
    };
};
