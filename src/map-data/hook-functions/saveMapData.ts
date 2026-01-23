import { copyFile, mkdir, rename, unlink, readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import MapData from '../types/mapData';

export type SaveMapDataHookFn = (
    sourceFilePath: string | undefined,
    geoJsonFilePath: string | undefined,
    vectorTileFilePath: string | undefined,
    mapDataId: string,
    isKml: boolean,
    sourceFileUrl: string,
    errorMessage: string | undefined,
) => Promise<MapData>;

const SAVED_MAP_DATA_DIR = '.savedMapData';

async function moveFile(sourcePath: string, destPath: string): Promise<void> {
    await mkdir(dirname(destPath), { recursive: true });

    // Remove destination file if it exists to ensure overwrite
    try {
        await unlink(destPath);
    } catch (err: any) {
        // Ignore error if file doesn't exist (ENOENT)
        if (err?.code !== 'ENOENT') {
            throw err;
        }
    }

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
    sourceFilePath: string | undefined,
    geoJsonFilePath: string | undefined,
    vectorTileFilePath: string | undefined,
    mapDataId: string,
    isKml: boolean,
    sourceFileUrl: string,
    errorMessage: string | undefined,
): Promise<MapData> => {
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

    let sourceFile: string | undefined;
    let geoJsonFile: string | undefined;
    let vectorTileFile: string | undefined;

    const uploadErrors: string[] = [];

    // Upload source file if provided
    // Note: PutObjectCommand overwrites existing objects with the same key by default
    if (sourceFilePath) {
        try {
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
            sourceFile = `https://${bucketName}.s3.amazonaws.com/${sourceS3Key}`;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            uploadErrors.push(`Failed to upload source file: ${errorMsg}`);
        }
    }

    // Upload GeoJSON file if provided
    // Note: PutObjectCommand overwrites existing objects with the same key by default
    if (geoJsonFilePath) {
        try {
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
            geoJsonFile = `https://${bucketName}.s3.amazonaws.com/${geoJsonS3Key}`;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            uploadErrors.push(`Failed to upload GeoJSON file: ${errorMsg}`);
        }
    }

    // Upload vector tile file if provided
    // Note: PutObjectCommand overwrites existing objects with the same key by default
    if (vectorTileFilePath) {
        try {
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
            vectorTileFile = `https://${bucketName}.s3.amazonaws.com/${vectorTileS3Key}`;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            uploadErrors.push(`Failed to upload vector tile file: ${errorMsg}`);
        }
    }

    if (uploadErrors.length) {
        errorMessage = uploadErrors.join('\n');
    }

    return new MapData(
        isKml ? undefined : sourceFile,
        isKml ? sourceFile : undefined,
        geoJsonFile,
        vectorTileFile,
        mapDataId,
        sourceFileUrl,
        errorMessage,
    );
};

export const nodeSaveMapData: SaveMapDataHookFn = async (
    sourceFilePath: string | undefined,
    geoJsonFilePath: string | undefined,
    vectorTileFilePath: string | undefined,
    mapDataId: string,
    isKml: boolean,
    sourceFileUrl: string,
    errorMessage: string | undefined,
): Promise<MapData> => {
    const projectRoot = process.cwd();

    const fileExtension = isKml ? 'kml' : 'gpx';
    const sourceDestPath = join(projectRoot, SAVED_MAP_DATA_DIR, 'source', `${mapDataId}.${fileExtension}`);
    const geoJsonDestPath = join(projectRoot, SAVED_MAP_DATA_DIR, 'geojson', `${mapDataId}.geojson`);
    const vectorTileDestPath = join(projectRoot, SAVED_MAP_DATA_DIR, 'vector-tiles', `${mapDataId}.mbtiles`);

    let sourceFile: string | undefined;
    let geoJsonFile: string | undefined;
    let vectorTileFile: string | undefined;

    const moveErrors: string[] = [];

    // Move source file if provided
    if (sourceFilePath) {
        try {
            await moveFile(sourceFilePath, sourceDestPath);
            sourceFile = sourceDestPath;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            moveErrors.push(`Failed to move source file: ${errorMsg}`);
        }
    }

    // Move GeoJSON file if provided
    if (geoJsonFilePath) {
        try {
            await moveFile(geoJsonFilePath, geoJsonDestPath);
            geoJsonFile = geoJsonDestPath;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            moveErrors.push(`Failed to move GeoJSON file: ${errorMsg}`);
        }
    }

    // Move vector tile file if provided
    if (vectorTileFilePath) {
        try {
            await moveFile(vectorTileFilePath, vectorTileDestPath);
            vectorTileFile = vectorTileDestPath;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            moveErrors.push(`Failed to move vector tile file: ${errorMsg}`);
        }
    }

    if (moveErrors.length) {
        errorMessage = moveErrors.join('\n');
    }

    return new MapData(
        isKml ? undefined : sourceFile,
        isKml ? sourceFile : undefined,
        geoJsonFile,
        vectorTileFile,
        mapDataId,
        sourceFileUrl,
        errorMessage,
    );
};
