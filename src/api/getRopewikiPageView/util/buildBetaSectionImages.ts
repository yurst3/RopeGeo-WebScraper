import type * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { OnlineBetaSection, OnlineBetaSectionImage } from 'ropegeo-common/models';
import {
    downloadBytesForBannerImage,
    downloadBytesForBetaSectionImage,
} from './downloadBytesFromImageMetadata';

export type PageViewImageRow = {
    id: string;
    order: number | null;
    linkUrl: string;
    caption: string | null;
    betaSection: string | null;
    latestRevisionDate: db.TimestampString;
    previewUrl: string | null;
    bannerUrl: string | null;
    fullUrl: string | null;
    linkPreviewUrl: string | null;
    metadata: db.JSONValue | null;
};

type BetaSectionRow = Pick<
    s.RopewikiBetaSection.JSONSelectable,
    'id' | 'order' | 'title' | 'text' | 'latestRevisionDate'
>;

function toOnlineBetaSectionImage(
    row: PageViewImageRow,
    downloadBytes: ReturnType<typeof downloadBytesForBannerImage>,
): OnlineBetaSectionImage {
    return new OnlineBetaSectionImage(
        row.order ?? 0,
        row.id,
        row.bannerUrl ?? null,
        row.fullUrl ?? null,
        row.linkUrl,
        row.caption,
        new Date(row.latestRevisionDate),
        downloadBytes,
    );
}

export function buildBannerImage(
    imageRows: PageViewImageRow[],
): OnlineBetaSectionImage | null {
    const bannerImageRow = imageRows.find((i) => i.betaSection == null);
    if (bannerImageRow == null) return null;
    return toOnlineBetaSectionImage(
        bannerImageRow,
        downloadBytesForBannerImage(bannerImageRow.metadata),
    );
}

export function buildBetaSectionsView(
    betaSections: BetaSectionRow[],
    imageRows: PageViewImageRow[],
): OnlineBetaSection[] {
    const imagesBySection = new Map<string | null, PageViewImageRow[]>();
    for (const img of imageRows) {
        const key = img.betaSection ?? null;
        if (!imagesBySection.has(key)) imagesBySection.set(key, []);
        imagesBySection.get(key)!.push(img);
    }

    return betaSections.map((sec) => {
        const secImages = (imagesBySection.get(sec.id) ?? []).map((i) =>
            toOnlineBetaSectionImage(i, downloadBytesForBetaSectionImage(i.metadata)),
        );
        return new OnlineBetaSection(
            sec.order ?? 0,
            sec.title,
            sec.text,
            new Date(sec.latestRevisionDate),
            secImages,
        );
    });
}
