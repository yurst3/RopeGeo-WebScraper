import { ImageVersion, VERSION_FORMAT } from 'ropegeo-common/classes';

/** Ordered list of all encoded output versions (excludes `source`, which is not an {@link ImageVersion}). */
export const ALL_IMAGE_VERSIONS: ImageVersion[] = [
    ImageVersion.preview,
    ImageVersion.linkPreview,
    ImageVersion.banner,
    ImageVersion.full,
    ImageVersion.lossless,
];

export function fileExtensionForImageVersion(v: ImageVersion): string {
    switch (VERSION_FORMAT[v]) {
        case 'image/jpeg':
            return '.jpg';
        case 'image/avif':
            return '.avif';
        default:
            return '.bin';
    }
}

const VERSION_SET = new Set<string>(Object.values(ImageVersion));

export function assertValidImageVersions(versions: unknown): versions is ImageVersion[] {
    if (!Array.isArray(versions)) {
        return false;
    }
    return versions.every((v) => typeof v === 'string' && VERSION_SET.has(v));
}
