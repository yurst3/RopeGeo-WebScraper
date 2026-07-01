import type { Archiver } from 'archiver';
import { ImageVersion } from 'ropegeo-common/models';
import { imageFileRelativePath } from 'ropegeo-common/helpers';
import { fileExtensionForImageVersion } from '../../../image-data/util/imageVersionFile';
import type { ImageBundleRow } from '../processors/processSourceFolders';
import { fetchS3ObjectBytes } from '../s3/fetchS3ObjectBytes';
import { zipStorePath } from './folderZipPaths';

async function appendImageVersionEntry(
    archive: Archiver,
    imageBucket: string,
    image: ImageBundleRow,
    version: ImageVersion.banner | ImageVersion.full,
): Promise<void> {
    const hasUrl = version === ImageVersion.banner ? image.bannerUrl : image.fullUrl;
    if (!hasUrl) {
        return;
    }

    const ext = fileExtensionForImageVersion(version);
    const s3Key = `${image.processedImageId}/${version}${ext}`;
    const entryPath = imageFileRelativePath(image.imageId, version, ext);
    const body = await fetchS3ObjectBytes(imageBucket, s3Key);
    archive.append(body, {
        name: entryPath,
        store: zipStorePath(entryPath),
    });
}

export async function appendImageEntriesToArchive(
    archive: Archiver,
    imageBucket: string,
    images: ImageBundleRow[],
): Promise<void> {
    for (const image of images) {
        await appendImageVersionEntry(archive, imageBucket, image, ImageVersion.banner);
        await appendImageVersionEntry(archive, imageBucket, image, ImageVersion.full);
    }
}
