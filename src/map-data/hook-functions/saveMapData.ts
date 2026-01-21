import { copyFile, mkdir, rename, unlink, readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export type SaveMapDataResult = {
    sourceFile: string;
    geoJsonFile: string;
    vectorTileFile: string;
};

export type SaveMapDataHookFn = (
    sourceFilePath: string,
    geoJsonFilePath: string,
    vectorTileFilePath: string,
    mapDataId: string,
    isKml: boolean,
) => Promise<SaveMapDataResult>;

const SAVED_MAP_DATA_DIR = '.savedMapData';

async function moveFile(sourcePath: string, destPath: string): Promise<void> {
    await mkdir(dirname(destPath), { recursive: true });

    try {
        await rename(sourcePath, destPath);
    } catch (err: any) {
        // Cross-device rename can fail (EXDEV); fall back to copy+unlink.
        if (err?.code === 'EXDEV') {
            await copyFile(sourcePath, destPath);
            await unlink(sourcePath);
            return;
        }
        throw err;
    }
}

export const lambdaSaveMapData: SaveMapDataHookFn = async (
    sourceFilePath: string,
    geoJsonFilePath: string,
    vectorTileFilePath: string,
    mapDataId: string,
    isKml: boolean,
): Promise<SaveMapDataResult> => {
    const bucketName = process.env.MAP_DATA_BUCKET_NAME;
    if (!bucketName) {
        throw new Error('MAP_DATA_BUCKET_NAME environment variable is not set');
    }

    console.log('Uploading map data files to S3...');
    const s3Client = new S3Client({});

    const fileExtension = isKml ? 'kml' : 'gpx';
    const sourceFileName = `${mapDataId}.${fileExtension}`;
    const geoJsonFileName = `${mapDataId}.geojson`;
    const vectorTileFileName = `${mapDataId}.mbtiles`;

    // Upload source file
    const sourceS3Key = `source/${sourceFileName}`;
    const sourceFileBuffer = await readFile(sourceFilePath);
    await s3Client.send(
        new PutObjectCommand({
            Bucket: bucketName,
            Key: sourceS3Key,
            Body: sourceFileBuffer,
            ContentType: isKml ? 'application/vnd.google-earth.kml+xml' : 'application/gpx+xml',
        }),
    );
    const sourceFile = `https://${bucketName}.s3.amazonaws.com/${sourceS3Key}`;

    // Upload GeoJSON file
    const geoJsonS3Key = `geojson/${geoJsonFileName}`;
    const geoJsonFileBuffer = await readFile(geoJsonFilePath);
    await s3Client.send(
        new PutObjectCommand({
            Bucket: bucketName,
            Key: geoJsonS3Key,
            Body: geoJsonFileBuffer,
            ContentType: 'application/geo+json',
        }),
    );
    const geoJsonFile = `https://${bucketName}.s3.amazonaws.com/${geoJsonS3Key}`;

    // Upload vector tile file
    const vectorTileS3Key = `vector-tiles/${vectorTileFileName}`;
    const vectorTileFileBuffer = await readFile(vectorTileFilePath);
    await s3Client.send(
        new PutObjectCommand({
            Bucket: bucketName,
            Key: vectorTileS3Key,
            Body: vectorTileFileBuffer,
            ContentType: 'application/x-protobuf',
        }),
    );
    const vectorTileFile = `https://${bucketName}.s3.amazonaws.com/${vectorTileS3Key}`;

    return {
        sourceFile,
        geoJsonFile,
        vectorTileFile,
    };
};

export const nodeSaveMapData: SaveMapDataHookFn = async (
    sourceFilePath: string,
    geoJsonFilePath: string,
    vectorTileFilePath: string,
    mapDataId: string,
    isKml: boolean,
): Promise<SaveMapDataResult> => {
    const projectRoot = process.cwd();

    const fileExtension = isKml ? 'kml' : 'gpx';
    const sourceDestPath = join(projectRoot, SAVED_MAP_DATA_DIR, 'source', `${mapDataId}.${fileExtension}`);
    const geoJsonDestPath = join(projectRoot, SAVED_MAP_DATA_DIR, 'geojson', `${mapDataId}.geojson`);
    const vectorTileDestPath = join(projectRoot, SAVED_MAP_DATA_DIR, 'vector-tiles', `${mapDataId}.mbtiles`);

    await moveFile(sourceFilePath, sourceDestPath);
    await moveFile(geoJsonFilePath, geoJsonDestPath);
    await moveFile(vectorTileFilePath, vectorTileDestPath);

    return {
        sourceFile: sourceDestPath,
        geoJsonFile: geoJsonDestPath,
        vectorTileFile: vectorTileDestPath,
    };
};
