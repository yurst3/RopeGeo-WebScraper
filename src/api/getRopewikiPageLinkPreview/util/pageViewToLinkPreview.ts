import type { RopewikiPageView } from 'ropegeo-common';
import { LinkPreview, LinkPreviewImage } from 'ropegeo-common';
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

function bannerDimensionsFromMetadata(metadata: unknown): { width: string; height: string } {
    if (metadata == null) {
        return { width: '', height: '' };
    }
    const m = Metadata.fromJSON(metadata);
    const b = m.banner;
    if (b?.dimensions) {
        return {
            width: String(b.dimensions.width),
            height: String(b.dimensions.height),
        };
    }
    return { width: '', height: '' };
}

/**
 * Builds {@link LinkPreview} for social/crawler use from a loaded page view and optional raw
 * ImageData.metadata for the banner row (for og:image dimensions).
 */
export function buildLinkPreviewFromPageView(
    view: RopewikiPageView,
    bannerMetadata: unknown | null,
): LinkPreview {
    const title = linkPreviewTitle(view);
    const description = linkPreviewDescription(view);

    const bannerUrl = view.bannerImage?.bannerUrl ?? null;
    let image: LinkPreviewImage | null = null;
    if (bannerUrl != null && bannerUrl !== '') {
        const { width, height } = bannerDimensionsFromMetadata(bannerMetadata);
        image = new LinkPreviewImage(
            bannerUrl,
            height,
            width,
            'image/avif',
            title,
        );
    }

    return new LinkPreview(title, description, image, 'RopeGeo', 'website');
}
