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

}