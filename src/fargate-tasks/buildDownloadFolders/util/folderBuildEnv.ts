export function getPageZipBucketName(): string {
    const bucket = process.env.PAGE_ZIP_BUCKET_NAME?.trim();
    if (!bucket) {
        throw new Error('PAGE_ZIP_BUCKET_NAME environment variable is not set');
    }
    return bucket;
}

export function getImageBucketName(): string {
    const bucket = process.env.IMAGE_BUCKET_NAME?.trim();
    if (!bucket) {
        throw new Error('IMAGE_BUCKET_NAME environment variable is not set');
    }
    return bucket;
}

export function getMapDataBucketName(): string {
    const bucket = process.env.MAP_DATA_BUCKET_NAME?.trim();
    if (!bucket) {
        throw new Error('MAP_DATA_BUCKET_NAME environment variable is not set');
    }
    return bucket;
}

export function isLocalFolderBuild(): boolean {
    return process.env.DEV_ENVIRONMENT === 'local';
}
