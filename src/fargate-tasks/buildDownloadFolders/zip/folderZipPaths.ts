export const PAGE_RESPONSE_JSON = 'page-response.json';
export const SAVED_DOWNLOAD_FOLDERS_DIR = '.savedDownloadFolders';
export const ZIP_CONTENT_TYPE = 'application/zip';

export function folderZipFileName(pageId: string): string {
    return `${pageId}.zip`;
}

export function zipStorePath(relativePath: string): boolean {
    return relativePath.endsWith('.avif') || relativePath.endsWith('.pbf');
}
