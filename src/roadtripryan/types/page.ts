export class RoadTripRyanPage {
    id: string | undefined
    url: string
    title: string
    region: string
    gpx: string | undefined
    rated: number | undefined
    length: number | undefined
    season: string | undefined
    gear: string | undefined
    rappels: number | undefined
    water: string | undefined
    flashFlood: string | undefined
    permitRequired: boolean
    tags: string[] 
    maps: string | undefined
    permitLink: string | undefined

    constructor (
    title: string,
    region: string,
    permitRequired: boolean,
    tags: string[],
    url: string,
    id?: string | undefined,
    gpx?: string,
    rated?: number,
    length?: number,
    season?: string,
    gear?: string,
    rappels?: number,
    water?: string,
    flashFlood?: string,
    maps?: string,
    permitLink?: string,
    ) {
        this.id = id;
        this.url = url;
        this.title = title;
        this.region = region;
        this.rated = rated;
        this.length = length;
        this.gpx = gpx;
        this.season = season;
        this.gear = gear;
        this.rappels = rappels;
        this.water = water;
        this.flashFlood = flashFlood;
        this.permitRequired = permitRequired;
        this.tags = tags;
        this.maps = maps;
        this.permitLink = permitLink;
    }
}