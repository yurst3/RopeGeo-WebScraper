export interface RopewikiRegion {
    id: string
    name: string
    parentRegion: string | undefined
}

export interface RopewikiBetaSection {
    title: string;
    text: string;
    order: number;
}

export interface RopewikiImage {
    betaSectionTitle: string | undefined;
    linkUrl: string;
    fileUrl: string;
    caption: string | undefined;
    order: number;
}

class RopewikiPageInfo {
    pageid: string
    name: string
    coordinates: { lat: number, lon: number } | undefined
    region: string
    quality: number | undefined
    rating: string | undefined
    timeRating: string | undefined
    kmlUrl: string | undefined
    technicalRating: string | undefined
    waterRating: string | undefined
    riskRating: string | undefined
    permits: string | undefined
    rappelInfo: string | undefined
    rappelCount: number | undefined
    rappelLongest: { value: number, unit: string } | undefined
    months: string[]
    shuttle: { value: number, unit: string } | undefined
    vehicle: string | undefined
    minTime: { value: number, unit: string } | undefined
    maxTime: { value: number, unit: string } | undefined
    hike: { value: number, unit: string } | undefined
    url: string
    aka: string[]
    betaSites: string[]
    userVotes: number | undefined
    latestRevisionDate: Date
    isValid: boolean
    
    constructor(raw: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { printouts } = raw as { printouts: any };

        // Check if required fields are present
        const pageid = printouts.pageid?.[0];
        const name = printouts.name?.[0];
        const region = printouts.region?.[0]?.fulltext;
        const url = printouts.url?.[0];
        
        // Check latestRevisionDate (required for validity, use default if not found)
        const latestRevisionDateRaw = Array.isArray(printouts.latestRevisionDate) && printouts.latestRevisionDate.length > 0
            ? printouts.latestRevisionDate[0]
            : undefined;
        const latestRevisionDate = latestRevisionDateRaw && latestRevisionDateRaw.timestamp
            ? new Date(Number(latestRevisionDateRaw.timestamp) * 1000) // Convert Unix timestamp (seconds) to milliseconds
            : new Date(0); // Default to epoch if not found

        // Set isValid based on whether all required fields are present (including valid latestRevisionDate)
        this.isValid = !!(pageid && name && region && url && (latestRevisionDateRaw && latestRevisionDateRaw.timestamp));

        // Required scalar fields - set to empty strings if missing
        this.pageid = pageid ? String(pageid) : '';
        this.name = name ? String(name) : '';
        this.region = region ? String(region) : '';
        this.url = url ? String(url) : '';

        // Optional simple scalars
        this.quality = Array.isArray(printouts.quality) && printouts.quality.length > 0
            ? Number(printouts.quality[0])
            : undefined;

        this.rating = Array.isArray(printouts.rating) && printouts.rating.length > 0
            ? String(printouts.rating[0])
            : undefined;

        this.timeRating = Array.isArray(printouts.timeRating) && printouts.timeRating.length > 0
            ? String(printouts.timeRating[0])
            : undefined;

        this.kmlUrl = Array.isArray(printouts.kmlUrl) && printouts.kmlUrl.length > 0
            ? String(printouts.kmlUrl[0])
            : undefined;

        this.technicalRating = Array.isArray(printouts.technicalRating) && printouts.technicalRating.length > 0
            ? String(printouts.technicalRating[0])
            : undefined;

        this.waterRating = Array.isArray(printouts.waterRating) && printouts.waterRating.length > 0
            ? String(printouts.waterRating[0])
            : undefined;

        this.riskRating = Array.isArray(printouts.riskRating) && printouts.riskRating.length > 0
            ? String(printouts.riskRating[0])
            : undefined;

        this.permits = Array.isArray(printouts.permits) && printouts.permits.length > 0
            ? String(printouts.permits[0])
            : undefined;

        this.rappelInfo = Array.isArray(printouts.rappelInfo) && printouts.rappelInfo.length > 0
            ? String(printouts.rappelInfo[0])
            : undefined;

        this.rappelCount = Array.isArray(printouts.rappelCount) && printouts.rappelCount.length > 0
            ? Number(printouts.rappelCount[0])
            : undefined;

        this.vehicle = Array.isArray(printouts.vehicle) && printouts.vehicle.length > 0
            ? String(printouts.vehicle[0])
            : undefined;

        // Optional object-valued fields (value/unit pairs)
        const coord = Array.isArray(printouts.coordinates) && printouts.coordinates.length > 0 ? printouts.coordinates[0] : undefined;
        this.coordinates = coord && coord.lat !== undefined && coord.lon !== undefined
            ? { lat: Number(coord.lat), lon: Number(coord.lon) }
            : undefined;

        const rappelLongest = Array.isArray(printouts.rappelLongest) && printouts.rappelLongest.length > 0 ? printouts.rappelLongest[0] : undefined;
        this.rappelLongest = rappelLongest && rappelLongest.value !== undefined && rappelLongest.unit !== undefined
            ? { value: Number(rappelLongest.value), unit: String(rappelLongest.unit) }
            : undefined;

        const shuttle = Array.isArray(printouts.shuttle) && printouts.shuttle.length > 0 ? printouts.shuttle[0] : undefined;
        this.shuttle = shuttle && shuttle.value !== undefined && shuttle.unit !== undefined
            ? { value: Number(shuttle.value), unit: String(shuttle.unit) }
            : undefined;

        const minTime = Array.isArray(printouts.minTime) && printouts.minTime.length > 0 ? printouts.minTime[0] : undefined;
        this.minTime = minTime && minTime.value !== undefined && minTime.unit !== undefined
            ? { value: Number(minTime.value), unit: String(minTime.unit) }
            : undefined;

        const maxTime = Array.isArray(printouts.maxTime) && printouts.maxTime.length > 0 ? printouts.maxTime[0] : undefined;
        this.maxTime = maxTime && maxTime.value !== undefined && maxTime.unit !== undefined
            ? { value: Number(maxTime.value), unit: String(maxTime.unit) }
            : undefined;

        const hike = Array.isArray(printouts.hike) && printouts.hike.length > 0 ? printouts.hike[0] : undefined;
        this.hike = hike && hike.value !== undefined && hike.unit !== undefined
            ? { value: Number(hike.value), unit: String(hike.unit) }
            : undefined;

        // Months is always an array of strings; fall back to []
        this.months = Array.isArray(printouts.months)
            ? printouts.months.map((m: unknown) => String(m))
            : [];

        // AKA is a semicolon-separated string in an array; split and trim
        this.aka = Array.isArray(printouts.aka) && printouts.aka.length > 0
            ? String(printouts.aka[0]).split(';').map((a: string) => a.trim()).filter((a: string) => a.length > 0)
            : [];

        // BetaSites is a comma-separated string in an array; split and trim
        this.betaSites = Array.isArray(printouts.betaSites) && printouts.betaSites.length > 0
            ? String(printouts.betaSites[0]).split(',').map((site: string) => site.trim()).filter((site: string) => site.length > 0)
            : [];

        // UserVotes is a number in an array
        this.userVotes = Array.isArray(printouts.userVotes) && printouts.userVotes.length > 0
            ? Number(printouts.userVotes[0])
            : undefined;

        // LatestRevisionDate was already parsed above for the isValid check
        this.latestRevisionDate = latestRevisionDate;
    }

    // https://ropewiki.com/index.php?title=Special:Properties&limit=500&offset=0
    // "Has ..." is the property as described in the link above
    static getApiRequestPrintouts() {
        return {
            pageid: 'Has pageid',
            name: 'Has name',
            coordinates: 'Has coordinates',
            region: 'Located in region',
            quality: 'Has user rating',
            rating: 'Has rating',
            timeRating: 'Has time rating',
            kmlUrl: 'Has KML file',
            technicalRating: 'Has technical rating',
            waterRating: 'Has water rating',
            riskRating: 'Has extra risk rating',
            permits: 'Requires permits',
            rappelInfo: 'Has info rappels',
            rappelCount: 'Has number of rappels',
            rappelLongest: 'Has longest rappel',
            months: 'Has best month',
            shuttle: 'Has shuttle length',
            vehicle: 'Has vehicle type',
            minTime: 'Has fastest typical time',
            maxTime: 'Has slowest typical time',
            hike: 'Has length of hike',
            url: 'Has url',
            aka: 'Has AKA',
            betaSites: 'Has BetaSites list',
            userVotes: 'Has total counter',
            latestRevisionDate: 'Modification date'
        };
    }
}

export default RopewikiPageInfo;