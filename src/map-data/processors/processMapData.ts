import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import MapData from '../types/mapData';
import type { SaveMapDataHookFn } from '../hook-functions/saveMapData';
import { downloadSourceFile } from '../http/downloadSourceFile';
import { convertToGeoJson } from '../util/convertToGeoJson';
import { convertToTileDirectory } from '../util/convertToTileDirectory';
import ProgressLogger from '../../helpers/progressLogger';

/**
 * Processes map data by downloading the source file, converting to GeoJSON and a tile directory,
 * then calling the save hook to persist files (e.g., upload to S3 in Lambda, or move to .savedMapData
 * in Node). The hook receives the local tiles directory path and is responsible for uploading or
 * moving it and setting MapData.tilesTemplate.
 *
 * @param sourceFileUrl - URL of the source file (KML or GPX)
 * @param saveMapDataHookFn - Hook function to persist produced files and return MapData.
 * @param mapDataId - Optional UUID for the map data. If not provided, a new UUID will be generated.
 * @param logger - Progress logger for tracking processing progress
 * @param abortSignal - Optional AbortSignal; when aborted, the download is cancelled
 * @returns Promise that resolves to a MapData object with URLs/paths (including tiles)
 */
export const processMapData = async (
    sourceFileUrl: string,
    saveMapDataHookFn: SaveMapDataHookFn,
    mapDataId: string | null | undefined,
    logger: ProgressLogger,
    abortSignal?: AbortSignal,
): Promise<MapData> => {
    const tempDir = await mkdtemp(join(tmpdir(), 'map-data-'));
    const finalMapDataId = mapDataId ?? randomUUID();

    try {
        const urlLower = sourceFileUrl.toLowerCase();
        const isKml = urlLower.endsWith('.kml');
        const isGpx = urlLower.endsWith('.gpx');

        if (!isKml && !isGpx) {
            const errorMessage = `Unsupported file type. Expected .kml or .gpx, got: ${sourceFileUrl}`;
            console.error(errorMessage);
            return new MapData(
                undefined,
                undefined,
                undefined,
                undefined,
                finalMapDataId,
                sourceFileUrl,
                errorMessage,
            );
        }

        let errorMessage: string | undefined;

        const { filePath: sourceFilePath, content: sourceFileContent } = await downloadSourceFile(
            sourceFileUrl,
            tempDir,
            finalMapDataId,
            isKml,
            abortSignal
        );

        let geoJsonFilePath: string | undefined;
        const { filePath: geoJsonPath, error: geoJsonError } = await convertToGeoJson(
            sourceFileContent,
            tempDir,
            finalMapDataId,
            isKml
        );
        geoJsonFilePath = geoJsonPath;
        errorMessage = geoJsonError;

        let tilesDirPath: string | undefined;
        if (geoJsonFilePath && !errorMessage) {
            const tilesOutputDir = join(tempDir, 'tiles');
            const result = await convertToTileDirectory(
                geoJsonFilePath,
                tilesOutputDir,
                finalMapDataId,
            );
            if ('error' in result) {
                errorMessage = result.error;
            } else {
                tilesDirPath = result.tilesDir;
            }
        }

        if (abortSignal?.aborted) {
            const reason =
                abortSignal.reason instanceof Error
                    ? abortSignal.reason
                    : new Error(String(abortSignal.reason));
            throw reason;
        }

        return await saveMapDataHookFn(
            sourceFilePath,
            geoJsonFilePath,
            tilesDirPath,
            finalMapDataId,
            isKml,
            sourceFileUrl,
            errorMessage,
            logger,
        );
    } finally {
        await rm(tempDir, { recursive: true, force: true });
    }
};
