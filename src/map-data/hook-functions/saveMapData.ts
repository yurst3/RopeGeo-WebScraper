import { join } from 'path';
import type { Pool } from 'pg';
import MapData from '../types/mapData';
import ProgressLogger from '../../helpers/progressLogger';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import uploadMapDataToS3 from '../s3/uploadMapDataToS3';
import getMapData from '../database/getMapData';
import moveFile from '../util/moveFile';

const SKIP_S3_REASON = 'skipping S3 upload because there is no S3 Bucket configured';

let _localPool: Pool | null = null;
async function getLocalPool(): Promise<Pool> {
    if (!_localPool) {
        _localPool = await getDatabaseConnection();
    }
    return _localPool;
}

export type SaveMapDataHookFn = (
    sourceFilePath: string | undefined,
    geoJsonFilePath: string | undefined,
    vectorTileFilePath: string | undefined,
    mapDataId: string,
    isKml: boolean,
    sourceFileUrl: string,
    errorMessage: string | undefined,
    logger: ProgressLogger,
) => Promise<MapData>;

const SAVED_MAP_DATA_DIR = '.savedMapData';

/**
 * Save-map-data hook for Lambda (or local invoke): persists source, GeoJSON, and vector tile files
 * and returns a MapData instance with their URLs.
 * When DEV_ENVIRONMENT is "local", skips S3 and returns existing MapData from the database by
 * mapDataId (or a MapData with an error if not found). Otherwise uploads each file to the
 * MAP_DATA_BUCKET_NAME S3 bucket and returns a MapData with the resulting URLs. Collects per-file
 * upload errors into the returned MapData.errorMessage and logs progress or errors via the logger.
 */
export const lambdaSaveMapData: SaveMapDataHookFn = async (
    sourceFilePath: string | undefined,
    geoJsonFilePath: string | undefined,
    vectorTileFilePath: string | undefined,
    mapDataId: string,
    isKml: boolean,
    sourceFileUrl: string,
    errorMessage: string | undefined,
    logger: ProgressLogger,
): Promise<MapData> => {
    if (process.env.DEV_ENVIRONMENT === 'local') {
        const pool = await getLocalPool();
        const client = await pool.connect();
        try {
            const existing = await getMapData(client, mapDataId);
            if (existing) {
                logger.logProgress(`Map data ${mapDataId} processed successfully - ${SKIP_S3_REASON}`);
                return existing;
            }
            logger.logError(`Map data ${mapDataId} not found - ${SKIP_S3_REASON}`);
            return new MapData(
                undefined,
                undefined,
                undefined,
                undefined,
                mapDataId,
                sourceFileUrl,
                `Map data not found (${SKIP_S3_REASON})`,
            );
        } finally {
            client.release();
        }
    }

    const bucketName = process.env.MAP_DATA_BUCKET_NAME;
    if (!bucketName) {
        throw new Error('MAP_DATA_BUCKET_NAME environment variable is not set');
    }

    const fileExtension = isKml ? 'kml' : 'gpx';
    const sourceFileName = `${mapDataId}.${fileExtension}`;
    const geoJsonFileName = `${mapDataId}.geojson`;
    const vectorTileFileName = `${mapDataId}.mbtiles`;

    let sourceFile: string | undefined;
    let geoJsonFile: string | undefined;
    let vectorTileFile: string | undefined;

    const uploadErrors: string[] = [];

    const sourceContentType = isKml ? 'application/vnd.google-earth.kml+xml' : 'application/gpx+xml';

    if (sourceFilePath) {
        try {
            sourceFile = await uploadMapDataToS3(
                sourceFilePath,
                `source/${sourceFileName}`,
                sourceContentType,
            );
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            uploadErrors.push(`Failed to upload source file: ${errorMsg}`);
        }
    }

    if (geoJsonFilePath) {
        try {
            geoJsonFile = await uploadMapDataToS3(
                geoJsonFilePath,
                `geojson/${geoJsonFileName}`,
                'application/geo+json',
            );
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            uploadErrors.push(`Failed to upload GeoJSON file: ${errorMsg}`);
        }
    }

    if (vectorTileFilePath) {
        try {
            vectorTileFile = await uploadMapDataToS3(
                vectorTileFilePath,
                `vector-tiles/${vectorTileFileName}`,
                'application/x-protobuf',
            );
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            uploadErrors.push(`Failed to upload vector tile file: ${errorMsg}`);
        }
    }

    if (uploadErrors.length) {
        errorMessage = uploadErrors.join('\n');
    }

    const mapData = new MapData(
        isKml ? undefined : sourceFile,
        isKml ? sourceFile : undefined,
        geoJsonFile,
        vectorTileFile,
        mapDataId,
        sourceFileUrl,
        errorMessage,
    );

    if (errorMessage) {
        logger.logError(`Map data ${mapDataId} ${errorMessage}`);
    } else {
        logger.logProgress(`Map data ${mapDataId} processed successfully`);
    }

    return mapData;
};

/**
 * Save-map-data hook for Node (e.g. scripts): moves source, GeoJSON, and vector tile files from
 * their temp paths into the project’s .savedMapData directory (source/, geojson/, vector-tiles/)
 * and returns a MapData instance with local file paths. Collects per-file move errors into the
 * returned MapData.errorMessage and logs progress or errors via the logger.
 */
export const nodeSaveMapData: SaveMapDataHookFn = async (
    sourceFilePath: string | undefined,
    geoJsonFilePath: string | undefined,
    vectorTileFilePath: string | undefined,
    mapDataId: string,
    isKml: boolean,
    sourceFileUrl: string,
    errorMessage: string | undefined,
    logger: ProgressLogger,
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

    const mapData = new MapData(
        isKml ? undefined : sourceFile,
        isKml ? sourceFile : undefined,
        geoJsonFile,
        vectorTileFile,
        mapDataId,
        sourceFileUrl,
        errorMessage,
    );

    if (errorMessage) {
        logger.logError(`Map data ${mapDataId} ${errorMessage}`);
    } else {
        logger.logProgress(`Map data ${mapDataId} processed successfully`);
    }

    return mapData;
};
