import type { Archiver } from 'archiver';
import type { PoolClient } from 'pg';
import type { OnlinePageView } from 'ropegeo-common/models';
import type { ImageBundleRow } from '../processors/processSourceFolders';
import { getImageBucketName, isLocalFolderBuild } from '../util/folderBuildEnv';
import { appendImageEntriesToArchive } from './appendImageEntriesToArchive';
import { appendOnlineMiniMapEntriesToArchive } from './appendOnlineMiniMapEntriesToArchive';
import { PAGE_RESPONSE_JSON } from './folderZipPaths';

export function createZipEntryWriter(
    conn: PoolClient,
    regionId: string,
    view: OnlinePageView,
    pageJson: string,
    images: ImageBundleRow[],
): (archive: Archiver) => Promise<void> {
    return async (archive: Archiver): Promise<void> => {
        archive.append(pageJson, { name: PAGE_RESPONSE_JSON });

        if (isLocalFolderBuild()) {
            return;
        }

        await appendImageEntriesToArchive(archive, getImageBucketName(), images);
        await appendOnlineMiniMapEntriesToArchive(archive, conn, regionId, view);
    };
}
