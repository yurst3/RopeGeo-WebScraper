export class RoadTripRyanRegion {
    id: string | undefined
    url: string
    name: string
    parentRegion: string | undefined
    pageCount: number

    constructor(
        name: string,
        parentRegion: string | undefined,
        pageCount: number,
        url: string,
        id?: string,
    ) {
        this.id = id;
        this.url = url;
        this.name = name;
        this.parentRegion = parentRegion;
        this.pageCount = pageCount;
    }

    static fromAnchorElement(anchor: Element, parentRegion?: string): RoadTripRyanRegion {
        const name: string = anchor.textContent;
        const href: string | undefined = anchor.attributes.getNamedItem('href')?.value;

        if (!href) {
            throw new Error("Anchor element is missing href attribute");
        }

        const url: string = "https://www.roadtripryan.com/" + href;

        const pageCount = 0;

        return new RoadTripRyanRegion(name, parentRegion, pageCount, url);
    }
}