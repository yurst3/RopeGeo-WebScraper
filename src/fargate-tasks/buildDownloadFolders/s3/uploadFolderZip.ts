import { readFile } from 'fs/promises';
import { putS3Object } from 'ropegeo-common/helpers';
import { getPageZipBucketName } from '../util/folderBuildEnv';
import { ZIP_CONTENT_TYPE } from '../zip/folderZipPaths';

export async function uploadFolderZip(zipFileName: string, zipPath: string): Promise<void> {
    const zipBody = await readFile(zipPath);
    await putS3Object(getPageZipBucketName(), zipFileName, zipBody, ZIP_CONTENT_TYPE);
}
