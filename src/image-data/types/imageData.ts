import type * as s from 'zapatos/schema';

export class ImageData {
    id: string | undefined;
    previewUrl: string | undefined;
    bannerUrl: string | undefined;
    fullUrl: string | undefined;
    sourceUrl: string | undefined;
    errorMessage: string | undefined;

    constructor(
        previewUrl?: string,
        bannerUrl?: string,
        fullUrl?: string,
        sourceUrl?: string,
        errorMessage?: string,
        id?: string,
    ) {
        this.previewUrl = previewUrl;
        this.bannerUrl = bannerUrl;
        this.fullUrl = fullUrl;
        this.sourceUrl = sourceUrl;
        this.errorMessage = errorMessage;
        this.id = id;
    }

    toDbRow(): s.ImageData.Insertable {
        const now = new Date();
        const row: s.ImageData.Insertable = {
            previewUrl: this.previewUrl ?? null,
            bannerUrl: this.bannerUrl ?? null,
            fullUrl: this.fullUrl ?? null,
            sourceUrl: this.sourceUrl ?? null,
            errorMessage: this.errorMessage ?? null,
            updatedAt: now,
            deletedAt: null,
        };

        if (this.id) {
            row.id = this.id;
        }

        return row;
    }

    static fromDbRow(row: s.ImageData.JSONSelectable): ImageData {
        return new ImageData(
            row.previewUrl ?? undefined,
            row.bannerUrl ?? undefined,
            row.fullUrl ?? undefined,
            row.sourceUrl ?? undefined,
            row.errorMessage ?? undefined,
            row.id,
        );
    }
}

export default ImageData;
