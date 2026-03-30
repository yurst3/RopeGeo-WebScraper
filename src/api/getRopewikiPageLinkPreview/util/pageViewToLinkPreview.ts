import type { RopewikiPageView } from 'ropegeo-common';
import { ImageVersion, LinkPreview, LinkPreviewImage } from 'ropegeo-common';
import { Metadata } from '../../../image-data/types/metadata';

/**
 * Difficulty line aligned with mobile PagePreview (technical + water + time + risk).
 */
export function formatDifficultyForLinkPreview(view: RopewikiPageView): string {
    const d = view.difficulty;
    const main = [d.technical, d.water]
        .filter((x): x is NonNullable<typeof x> => x != null)
        .map((x) => String(x))
        .join('');
    const timePart = d.time != null ? ` ${String(d.time)}` : '';
    const riskPart = d.risk != null ? ` ${String(d.risk)}` : '';
    return (main + timePart + riskPart).trim();
}

function formatRappelSegment(view: RopewikiPageView): string | null {
    const rc = view.rappelCount;
    let countLabel: string | null = null;
    if (rc == null) {
        countLabel = null;
    } else if (typeof rc === 'number') {
        countLabel = `${rc} rappel${rc === 1 ? '' : 's'}`;
    } else {
        const { min, max } = rc;
        if (min === max) {
            countLabel = `${min} rappel${min === 1 ? '' : 's'}`;
        } else {
            countLabel = `${min}-${max} rappels`;
        }
    }

    const longest = view.rappelLongest;
    const longestPart =
        longest != null && Number.isFinite(longest)
            ? ` (${Math.round(longest)}ft max)`
            : '';

    if (countLabel != null && longestPart !== '') {
        return `${countLabel}${longestPart}`;
    }
    if (countLabel != null) {
        return countLabel;
    }
    if (longestPart !== '') {
        return `Rappels${longestPart}`;
    }
    return null;
}

function linkPreviewTitle(view: RopewikiPageView): string {
    const aka = view.aka.filter((s) => s.trim() !== '');
    if (aka.length === 0) {
        return view.name;
    }
    return `${view.name} AKA ${aka.join(', ')}`;
}

function linkPreviewDescription(view: RopewikiPageView): string {
    const parts: string[] = [];
    const diffStr = formatDifficultyForLinkPreview(view);
    if (diffStr !== '') {
        parts.push(diffStr);
    }
    const rappelStr = formatRappelSegment(view);
    if (rappelStr != null) {
        parts.push(rappelStr);
    }
    if (parts.length === 0) {
        return 'Ropewiki page';
    }
    return parts.join(', ');
}

export type BannerImageLinkContext = {
    metadata: unknown | null;
    linkPreviewUrl: string | null;
};

function dimensionsFromMetadata(
    metadata: unknown,
    version: ImageVersion,
): { width: string; height: string } {
    if (metadata == null) {
        return { width: '', height: '' };
    }
    const m = Metadata.fromJSON(metadata);
    const block = m[version] ?? null;
    if (block?.dimensions) {
        return {
            width: String(block.dimensions.width),
            height: String(block.dimensions.height),
        };
    }
    return { width: '', height: '' };
}

function mimeFromMetadata(metadata: unknown, version: ImageVersion): string {
    if (metadata == null) {
        return 'image/avif';
    }
    const m = Metadata.fromJSON(metadata);
    return m[version]?.mimeType ?? 'image/avif';
}

/**
 * Builds {@link LinkPreview} for social/crawler use from a loaded page view and banner ImageData fields.
 */
export function buildLinkPreviewFromPageView(
    view: RopewikiPageView,
    banner: BannerImageLinkContext | null,
): LinkPreview {
    const title = linkPreviewTitle(view);
    const description = linkPreviewDescription(view);

    const bannerUrl = view.bannerImage?.bannerUrl ?? null;
    const linkPreviewUrlFromPage = (
        view.bannerImage as { linkPreviewUrl?: string | null } | null | undefined
    )?.linkPreviewUrl;
    const linkPreviewUrl =
        (linkPreviewUrlFromPage != null && linkPreviewUrlFromPage !== ''
            ? linkPreviewUrlFromPage
            : null) ??
        (banner?.linkPreviewUrl != null && banner.linkPreviewUrl !== '' ? banner.linkPreviewUrl : null);

    const imageUrl =
        linkPreviewUrl != null && linkPreviewUrl !== ''
            ? linkPreviewUrl
            : bannerUrl != null && bannerUrl !== ''
              ? bannerUrl
              : null;

    let image: LinkPreviewImage | null = null;
    if (imageUrl != null && imageUrl !== '') {
        const useLinkPreview = imageUrl === linkPreviewUrl && linkPreviewUrl !== null && linkPreviewUrl !== '';
        const metaVersion = useLinkPreview ? ImageVersion.linkPreview : ImageVersion.banner;
        const metaSource = banner?.metadata ?? null;
        const { width, height } = dimensionsFromMetadata(metaSource, metaVersion);
        const mime = mimeFromMetadata(metaSource, metaVersion);
        image = new LinkPreviewImage(imageUrl, height, width, mime, title);
    }

    return new LinkPreview(title, description, image, 'RopeGeo', 'website');
}
