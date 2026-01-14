import type * as s from 'zapatos/schema';

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
    id: string | undefined
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

    /**
     * Parses an optional scalar string field from printouts
     */
    private static parseOptionalString(printouts: any, fieldName: string): string | undefined {
        return Array.isArray(printouts[fieldName]) && printouts[fieldName].length > 0
            ? String(printouts[fieldName][0])
            : undefined;
    }

    /**
     * Parses an optional scalar number field from printouts
     */
    private static parseOptionalNumber(printouts: any, fieldName: string): number | undefined {
        return Array.isArray(printouts[fieldName]) && printouts[fieldName].length > 0
            ? Number(printouts[fieldName][0])
            : undefined;
    }

    /**
     * Parses an optional value/unit object pair from printouts
     */
    private static parseOptionalValueUnit(printouts: any, fieldName: string): { value: number, unit: string } | undefined {
        const field = Array.isArray(printouts[fieldName]) && printouts[fieldName].length > 0 ? printouts[fieldName][0] : undefined;
        return field && field.value !== undefined && field.unit !== undefined
            ? { value: Number(field.value), unit: String(field.unit) }
            : undefined;
    }

    /**
     * Parses coordinates (lat/lon) from printouts
     */
    private static parseCoordinates(printouts: any): { lat: number, lon: number } | undefined {
        const coord = Array.isArray(printouts.coordinates) && printouts.coordinates.length > 0 ? printouts.coordinates[0] : undefined;
        return coord && coord.lat !== undefined && coord.lon !== undefined
            ? { lat: Number(coord.lat), lon: Number(coord.lon) }
            : undefined;
    }
    
    constructor(raw: unknown, regionNameIds: {[name: string]: string}) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { printouts } = raw as { printouts: any };

        // Check if required fields are present
        const pageid = printouts.pageid?.[0];
        const name = printouts.name?.[0];
        const regionName = printouts.region?.[0]?.fulltext;
        const url = printouts.url?.[0];
        
        // Check latestRevisionDate (required for validity, use default if not found)
        const latestRevisionDateRaw = Array.isArray(printouts.latestRevisionDate) && printouts.latestRevisionDate.length > 0
            ? printouts.latestRevisionDate[0]
            : undefined;
        const latestRevisionDate = latestRevisionDateRaw && latestRevisionDateRaw.timestamp
            ? new Date(Number(latestRevisionDateRaw.timestamp) * 1000) // Convert Unix timestamp (seconds) to milliseconds
            : new Date(0); // Default to epoch if not found

        // Map region name to region ID
        let regionId: string;
        let hasValidRegion = false;
        const defaultRegionId = '00000000-0000-0000-0000-000000000000'; // Default UUID for invalid regions
        
        if (regionName) {
            const mappedRegionId = regionNameIds[String(regionName)];
            if (mappedRegionId) {
                regionId = mappedRegionId;
                hasValidRegion = true;
            } else {
                // Log that we don't have an ID for this region
                console.error(`Page ${pageid || 'unknown'} ${name || 'unknown'} has region "${regionName}" that we don't have an ID for`);
                regionId = defaultRegionId;
                hasValidRegion = false;
            }
        } else {
            regionId = defaultRegionId;
            hasValidRegion = false;
        }

        // Set isValid based on whether all required fields are present (including valid latestRevisionDate and valid region)
        this.isValid = !!(pageid && name && hasValidRegion && url && (latestRevisionDateRaw && latestRevisionDateRaw.timestamp));

        // Required scalar fields - set to empty strings if missing
        this.pageid = pageid ? String(pageid) : '';
        this.name = name ? String(name) : '';
        this.region = regionId; // Store region ID, not name
        this.url = url ? String(url) : '';

        // Optional simple scalars
        this.quality = RopewikiPageInfo.parseOptionalNumber(printouts, 'quality');
        this.rating = RopewikiPageInfo.parseOptionalString(printouts, 'rating');
        this.timeRating = RopewikiPageInfo.parseOptionalString(printouts, 'timeRating');
        this.kmlUrl = RopewikiPageInfo.parseOptionalString(printouts, 'kmlUrl');
        this.technicalRating = RopewikiPageInfo.parseOptionalString(printouts, 'technicalRating');
        this.waterRating = RopewikiPageInfo.parseOptionalString(printouts, 'waterRating');
        this.riskRating = RopewikiPageInfo.parseOptionalString(printouts, 'riskRating');
        this.permits = RopewikiPageInfo.parseOptionalString(printouts, 'permits');
        this.rappelInfo = RopewikiPageInfo.parseOptionalString(printouts, 'rappelInfo');
        this.rappelCount = RopewikiPageInfo.parseOptionalNumber(printouts, 'rappelCount');
        this.vehicle = RopewikiPageInfo.parseOptionalString(printouts, 'vehicle');

        // Optional object-valued fields
        this.coordinates = RopewikiPageInfo.parseCoordinates(printouts);
        this.rappelLongest = RopewikiPageInfo.parseOptionalValueUnit(printouts, 'rappelLongest');
        this.shuttle = RopewikiPageInfo.parseOptionalValueUnit(printouts, 'shuttle');
        this.minTime = RopewikiPageInfo.parseOptionalValueUnit(printouts, 'minTime');
        this.maxTime = RopewikiPageInfo.parseOptionalValueUnit(printouts, 'maxTime');
        this.hike = RopewikiPageInfo.parseOptionalValueUnit(printouts, 'hike');

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

    toDbRow(): s.RopewikiPage.Insertable {
        const now = new Date();
        return {
            pageId: this.pageid,
            name: this.name,
            region: this.region,
            url: this.url,
            rating: this.rating ?? null,
            timeRating: this.timeRating ?? null,
            kmlUrl: this.kmlUrl ?? null,
            technicalRating: this.technicalRating ?? null,
            waterRating: this.waterRating ?? null,
            riskRating: this.riskRating ?? null,
            permits: this.permits ?? null,
            rappelInfo: this.rappelInfo ?? null,
            rappelCount: this.rappelCount ?? null,
            vehicle: this.vehicle ?? null,
            quality: this.quality ?? null,
            coordinates: this.coordinates ? JSON.stringify(this.coordinates) : null,
            rappelLongest: this.rappelLongest ? JSON.stringify(this.rappelLongest) : null,
            shuttle: this.shuttle ? JSON.stringify(this.shuttle) : null,
            minTime: this.minTime ? JSON.stringify(this.minTime) : null,
            maxTime: this.maxTime ? JSON.stringify(this.maxTime) : null,
            hike: this.hike ? JSON.stringify(this.hike) : null,
            months: this.months && this.months.length > 0 ? JSON.stringify(this.months) : null,
            aka: this.aka && this.aka.length > 0 ? JSON.stringify(this.aka) : null,
            betaSites: this.betaSites && this.betaSites.length > 0 ? JSON.stringify(this.betaSites) : null,
            userVotes: this.userVotes ?? null,
            latestRevisionDate: this.latestRevisionDate,
            updatedAt: now,
            deletedAt: null,
        };
    }

    static fromDbRow(row: s.RopewikiPage.JSONSelectable): RopewikiPageInfo {
        // Create an instance without calling the constructor
        const instance = Object.create(RopewikiPageInfo.prototype) as RopewikiPageInfo;

        // Parse JSON fields back to their original format
        const coordinates = row.coordinates as { lat: number; lon: number } | null;
        const rappelLongest = row.rappelLongest as { value: number; unit: string } | null;
        const shuttle = row.shuttle as { value: number; unit: string } | null;
        const minTime = row.minTime as { value: number; unit: string } | null;
        const maxTime = row.maxTime as { value: number; unit: string } | null;
        const hike = row.hike as { value: number; unit: string } | null;
        const months = row.months as string[] | null;
        const aka = row.aka as string[] | null;
        const betaSites = row.betaSites as string[] | null;

        // Set properties directly
        instance.id = row.id;
        instance.pageid = row.pageId;
        instance.name = row.name;
        instance.region = row.region;
        instance.url = row.url;
        instance.rating = row.rating ?? undefined;
        instance.timeRating = row.timeRating ?? undefined;
        instance.kmlUrl = row.kmlUrl ?? undefined;
        instance.technicalRating = row.technicalRating ?? undefined;
        instance.waterRating = row.waterRating ?? undefined;
        instance.riskRating = row.riskRating ?? undefined;
        instance.permits = row.permits ?? undefined;
        instance.rappelInfo = row.rappelInfo ?? undefined;
        instance.rappelCount = row.rappelCount ?? undefined;
        instance.vehicle = row.vehicle ?? undefined;
        instance.quality = row.quality ?? undefined;
        instance.coordinates = coordinates ?? undefined;
        instance.rappelLongest = rappelLongest ?? undefined;
        instance.shuttle = shuttle ?? undefined;
        instance.minTime = minTime ?? undefined;
        instance.maxTime = maxTime ?? undefined;
        instance.hike = hike ?? undefined;
        instance.months = months ?? [];
        instance.aka = aka ?? [];
        instance.betaSites = betaSites ?? [];
        instance.userVotes = row.userVotes ?? undefined;
        instance.latestRevisionDate = new Date(row.latestRevisionDate);
        instance.isValid = !!(instance.pageid && instance.name && instance.region && instance.url && instance.latestRevisionDate);

        return instance;
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