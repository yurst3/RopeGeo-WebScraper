import { join } from 'path';
import type { PoolClient } from 'pg';
import type { OnlinePageView } from 'ropegeo-common/models';
import type { ImageBundleRow, UpdateFolderForPage } from './processSourceFolders';
import { uploadFolderZip } from '../s3/uploadFolderZip';
import { isLocalFolderBuild } from '../util/folderBuildEnv';
import { createZipEntryWriter } from '../zip/createZipEntryWriter';
import {
    folderZipFileName,
    SAVED_DOWNLOAD_FOLDERS_DIR,
} from '../zip/folderZipPaths';
import { writeZipToFile } from '../zip/writeZipToFile';

export async function persistFolderZip(
    conn: PoolClient,
    pageId: string,
    regionId: string,
    view: OnlinePageView,
    images: ImageBundleRow[],
    updateFolderForPage: UpdateFolderForPage,
): Promise<void> {
    const pageJson = JSON.stringify(view);
    const zipFileName = folderZipFileName(pageId);
    const writeEntries = createZipEntryWriter(conn, regionId, view, pageJson, images);

    if (isLocalFolderBuild()) {
        await writeZipToFile(join(SAVED_DOWNLOAD_FOLDERS_DIR, zipFileName), writeEntries);
        await updateFolderForPage(conn, pageId);
        return;
    }

    const tempZipPath = join('/tmp', zipFileName);
    await writeZipToFile(tempZipPath, writeEntries);
    await uploadFolderZip(zipFileName, tempZipPath);
    await updateFolderForPage(conn, pageId);
}
