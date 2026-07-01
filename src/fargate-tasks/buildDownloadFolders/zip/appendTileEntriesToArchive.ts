import type { Archiver } from 'archiver';
import { gunzipSync } from 'zlib';
import { tileFileRelativePath } from 'ropegeo-common/helpers';
import listAllPbfKeysAndTotalBytes from '../../../api/getMapdataTiles/s3/listAllPbfKeysAndTotalBytes';
import { fetchS3ObjectBytes } from '../s3/fetchS3ObjectBytes';

function parseTileKey(mapDataId: string, key: string): { z: number; x: number; y: number } | null {
    const prefix = `tiles/${mapDataId}/`;
    if (!key.startsWith(prefix)) {
        return null;
    }

    const afterPrefix = key.slice(prefix.length);
    const parts = afterPrefix.split('/');
    if (parts.length !== 3) {
        return null;
    }

    const z = Number(parts[0]);
    const x = Number(parts[1]);
    const yWithExt = parts[2];
    if (!Number.isFinite(z) || !Number.isFinite(x) || !yWithExt?.endsWith('.pbf')) {
        return null;
    }

    const y = Number(yWithExt.replace(/\.pbf$/, ''));
    if (!Number.isFinite(y)) {
        return null;
    }

    return { z, x, y };
}

export async function appendTileEntriesToArchive(
    archive: Archiver,
    mapDataBucket: string,
    mapDataId: string,
): Promise<void> {
    const { keys } = await listAllPbfKeysAndTotalBytes(mapDataId);

    for (const key of keys) {
        const coords = parseTileKey(mapDataId, key);
        if (coords == null) {
            continue;
        }

        const entryPath = tileFileRelativePath(mapDataId, coords.z, coords.x, coords.y);
        const body = await fetchS3ObjectBytes(mapDataBucket, key);
        const tileBuffer = gunzipSync(body);
        archive.append(tileBuffer, {
            name: entryPath,
            store: true,
        });
    }
}
