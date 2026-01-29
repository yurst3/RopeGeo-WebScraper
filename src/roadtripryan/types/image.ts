export class RoadTripRyanImage {
    caption: string | undefined
    page: string | undefined
    region: string | undefined
    isBanner: boolean
    id: string | undefined
    url: string

    constructor(
        caption: string | undefined,
        page: string | undefined,
        region: string | undefined,
        isBanner: boolean,
        url: string,
        id?: string | undefined,
    ) {
        this.url = url;
        this.id = id;
        this.caption = caption;
        this.page = page;
        this.region = region;
        this.isBanner = isBanner;
    }
}