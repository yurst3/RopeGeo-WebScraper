export class RoadTripRyanBetaSection {
    id: string | undefined
    title: string
    text: string
    notes: string[]
    order: number
    page: string | undefined
    region: string | undefined

    constructor(
        title: string,
        text: string,
        notes: string[],
        order: number,
        page: string | undefined,
        region: string | undefined,
        id?: string | undefined
    ) {
        this.id = id;
        this.title = title;
        this.text = text;
        this.notes = notes;
        this.order = order;
        this.page = page;
        this.region = region;
    }
}