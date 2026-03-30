import type * as s from 'zapatos/schema';
import { Metadata } from './metadata';

export class ImageData {
    id: string | undefined;
    previewUrl: string | undefined;
    bannerUrl: string | undefined;
    fullUrl: string | undefined;
    losslessUrl: string | undefined;
    linkPreviewUrl: string | undefined;
    sourceUrl: string | undefined;
    errorMessage: string | undefined;
    metadata: Metadata | undefined;

    constructor(
        previewUrl?: string,
        bannerUrl?: string,
        fullUrl?: string,
        losslessUrl?: string,
        linkPreviewUrl?: string,
        sourceUrl?: string,
        errorMessage?: string,
        id?: string,
        metadata?: Metadata,
    ) {
        this.previewUrl = previewUrl;
        this.bannerUrl = bannerUrl;
        this.fullUrl = fullUrl;
        this.losslessUrl = losslessUrl;
        this.linkPreviewUrl = linkPreviewUrl;
        this.sourceUrl = sourceUrl;
        this.errorMessage = errorMessage;
        this.id = id;
        this.metadata = metadata;
    }

    toDbRow(): s.ImageData.Insertable {
        const now = new Date();
        const metaFrag = this.metadata?.toMergeFragment();
        const row = {
            previewUrl: this.previewUrl ?? null,
            bannerUrl: this.bannerUrl ?? null,
            fullUrl: this.fullUrl ?? null,
            losslessUrl: this.losslessUrl ?? null,
            linkPreviewUrl: this.linkPreviewUrl ?? null,
            sourceUrl: this.sourceUrl ?? null,
            errorMessage: this.errorMessage ?? null,
            metadata:
                metaFrag != null && Object.keys(metaFrag).length > 0
                    ? (metaFrag as s.ImageData.Insertable['metadata'])
                    : null,
            updatedAt: now,
            deletedAt: null,
        };

        if (this.id) {
            (row as Record<string, unknown>).id = this.id;
        }

        return row as s.ImageData.Insertable;
    }

    static fromDbRow(row: s.ImageData.JSONSelectable): ImageData {
        return new ImageData(
            row.previewUrl ?? undefined,
            row.bannerUrl ?? undefined,
            row.fullUrl ?? undefined,
            row.losslessUrl ?? undefined,
            row.linkPreviewUrl ?? undefined,
            row.sourceUrl ?? undefined,
            row.errorMessage ?? undefined,
            row.id,
            row.metadata != null ? Metadata.fromJSON(row.metadata) : undefined,
        );
    }

    static fromError(errorMessage: string, id: string, sourceUrl?: string): ImageData {
        return new ImageData(
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            sourceUrl,
            errorMessage,
            id,
        );
    }
}

export default ImageData;
