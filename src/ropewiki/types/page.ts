import type * as s from 'zapatos/schema';
import type { SqsRecord } from '@aws-lambda-powertools/parser/types';
import type { LengthAndElevGain } from '../http/getLengthAndElevGains';

export { RopewikiBetaSection } from './betaSection';
export { RopewikiImage } from './image';

class RopewikiPage {
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
    shuttleTime: { value: number, unit: string } | undefined
    vehicle: string | undefined
    minOverallTime: { value: number, unit: string } | undefined
    maxOverallTime: { value: number, unit: string } | undefined
    overallLength: number | undefined
    approachLength: number | undefined
    approachElevGain: number | undefined
    descentLength: number | undefined
    descentElevGain: number | undefined
    exitLength: number | undefined
    exitElevGain: number | undefined
    minApproachTime: { value: number, unit: string } | undefined
    maxApproachTime: { value: number, unit: string } | undefined
    minDescentTime: { value: number, unit: string } | undefined
    maxDescentTime: { value: number, unit: string } | undefined
    minExitTime: { value: number, unit: string } | undefined
    maxExitTime: { value: number, unit: string } | undefined
    url: string
    aka: string[]
    betaSites: string[]
    userVotes: number | undefined
    latestRevisionDate: Date
    isValid: boolean

    constructor(
        pageid: string,
        name: string,
        region: string,
        url: string,
        latestRevisionDate: Date,
        coordinates?: { lat: number, lon: number },
        quality?: number,
        rating?: string,
        timeRating?: string,
        kmlUrl?: string,
        technicalRating?: string,
        waterRating?: string,
        riskRating?: string,
        permits?: string,
        rappelInfo?: string,
        rappelCount?: number,
        rappelLongest?: { value: number, unit: string },
        months?: string[],
        shuttleTime?: { value: number, unit: string },
        vehicle?: string,
        minOverallTime?: { value: number, unit: string },
        maxOverallTime?: { value: number, unit: string },
        overallLength?: number,
        approachLength?: number,
        approachElevGain?: number,
        descentLength?: number,
        descentElevGain?: number,
        exitLength?: number,
        exitElevGain?: number,
        minApproachTime?: { value: number, unit: string },
        maxApproachTime?: { value: number, unit: string },
        minDescentTime?: { value: number, unit: string },
        maxDescentTime?: { value: number, unit: string },
        minExitTime?: { value: number, unit: string },
        maxExitTime?: { value: number, unit: string },
        aka?: string[],
        betaSites?: string[],
        userVotes?: number,
        id?: string,
    ) {
        this.pageid = pageid;
        this.name = name;
        this.region = region;
        this.url = url;
        this.latestRevisionDate = latestRevisionDate;
        this.coordinates = coordinates;
        this.quality = quality;
        this.rating = rating;
        this.timeRating = timeRating;
        this.kmlUrl = kmlUrl;
        this.technicalRating = technicalRating;
        this.waterRating = waterRating;
        this.riskRating = riskRating;
        this.permits = permits;
        this.rappelInfo = rappelInfo;
        this.rappelCount = rappelCount;
        this.rappelLongest = rappelLongest;
        this.months = months ?? [];
        this.shuttleTime = shuttleTime;
        this.vehicle = vehicle;
        this.minOverallTime = minOverallTime;
        this.maxOverallTime = maxOverallTime;
        this.overallLength = overallLength;
        this.approachLength = approachLength;
        this.approachElevGain = approachElevGain;
        this.descentLength = descentLength;
        this.descentElevGain = descentElevGain;
        this.exitLength = exitLength;
        this.exitElevGain = exitElevGain;
        this.minApproachTime = minApproachTime;
        this.maxApproachTime = maxApproachTime;
        this.minDescentTime = minDescentTime;
        this.maxDescentTime = maxDescentTime;
        this.minExitTime = minExitTime;
        this.maxExitTime = maxExitTime;
        this.aka = aka ?? [];
        this.betaSites = betaSites ?? [];
        this.userVotes = userVotes;
        this.id = id;

        // Calculate isValid based on required fields
        // Must have: pageid, name, valid region (not default UUID), url, and valid latestRevisionDate (not epoch)
        const defaultRegionId = '00000000-0000-0000-0000-000000000000';
        const hasValidRegion = region && region !== defaultRegionId;
        const hasValidRevisionDate = latestRevisionDate && latestRevisionDate.getTime() !== 0;
        this.isValid = !!(pageid && name && hasValidRegion && url && hasValidRevisionDate);
    }

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

    static fromResponseBody(raw: unknown, regionNameIds: {[name: string]: string}): RopewikiPage {
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
        const defaultRegionId = '00000000-0000-0000-0000-000000000000'; // Default UUID for invalid regions
        
        if (regionName) {
            const mappedRegionId = regionNameIds[String(regionName)];
            if (mappedRegionId) {
                regionId = mappedRegionId;
            } else {
                // Log that we don't have an ID for this region
                console.error(`Page ${pageid || 'unknown'} ${name || 'unknown'} has region "${regionName}" that we don't have an ID for`);
                regionId = defaultRegionId;
            }
        } else {
            regionId = defaultRegionId;
        }

        // Required scalar fields - set to empty strings if missing
        const parsedPageid = pageid ? String(pageid) : '';
        const parsedName = name ? String(name) : '';
        const parsedUrl = url ? String(url) : '';

        // Optional simple scalars
        const quality = RopewikiPage.parseOptionalNumber(printouts, 'quality');
        const rating = RopewikiPage.parseOptionalString(printouts, 'rating');
        const timeRating = RopewikiPage.parseOptionalString(printouts, 'timeRating');
        const kmlUrl = RopewikiPage.parseOptionalString(printouts, 'kmlUrl');
        const technicalRating = RopewikiPage.parseOptionalString(printouts, 'technicalRating');
        const waterRating = RopewikiPage.parseOptionalString(printouts, 'waterRating');
        const riskRating = RopewikiPage.parseOptionalString(printouts, 'riskRating');
        const permits = RopewikiPage.parseOptionalString(printouts, 'permits');
        const rappelInfo = RopewikiPage.parseOptionalString(printouts, 'rappelInfo');
        const rappelCount = RopewikiPage.parseOptionalNumber(printouts, 'rappelCount');
        const vehicle = RopewikiPage.parseOptionalString(printouts, 'vehicle');

        // Optional object-valued fields
        const coordinates = RopewikiPage.parseCoordinates(printouts);
        const rappelLongest = RopewikiPage.parseOptionalValueUnit(printouts, 'rappelLongest');
        const shuttleTime = RopewikiPage.parseOptionalValueUnit(printouts, 'shuttleTime');
        const minOverallTime = RopewikiPage.parseOptionalValueUnit(printouts, 'minOverallTime');
        const maxOverallTime = RopewikiPage.parseOptionalValueUnit(printouts, 'maxOverallTime');
        const hikeLengthVu = RopewikiPage.parseOptionalValueUnit(printouts, 'hikeLength');
        const overallLengthVu = RopewikiPage.parseOptionalValueUnit(printouts, 'overallLength');
        const approachElevGainVu = RopewikiPage.parseOptionalValueUnit(printouts, 'approachElevGain');
        const exitElevGainVu = RopewikiPage.parseOptionalValueUnit(printouts, 'exitElevGain');
        const minApproachTime = RopewikiPage.parseOptionalValueUnit(printouts, 'minApproachTime');
        const maxApproachTime = RopewikiPage.parseOptionalValueUnit(printouts, 'maxApproachTime');
        const minDescentTime = RopewikiPage.parseOptionalValueUnit(printouts, 'minDescentTime');
        const maxDescentTime = RopewikiPage.parseOptionalValueUnit(printouts, 'maxDescentTime');
        const minExitTime = RopewikiPage.parseOptionalValueUnit(printouts, 'minExitTime');
        const maxExitTime = RopewikiPage.parseOptionalValueUnit(printouts, 'maxExitTime');

        // Months is always an array of strings; fall back to []
        const months = Array.isArray(printouts.months)
            ? printouts.months.map((m: unknown) => String(m))
            : [];

        // AKA is a semicolon-separated string in an array; split and trim
        const aka = Array.isArray(printouts.aka) && printouts.aka.length > 0
            ? String(printouts.aka[0]).split(';').map((a: string) => a.trim()).filter((a: string) => a.length > 0)
            : [];

        // BetaSites is a comma-separated string in an array; split and trim
        const betaSites = Array.isArray(printouts.betaSites) && printouts.betaSites.length > 0
            ? String(printouts.betaSites[0]).split(',').map((site: string) => site.trim()).filter((site: string) => site.length > 0)
            : [];

        // UserVotes is a number in an array
        const userVotes = Array.isArray(printouts.userVotes) && printouts.userVotes.length > 0
            ? Number(printouts.userVotes[0])
            : undefined;

        return new RopewikiPage(
            parsedPageid,
            parsedName,
            regionId,
            parsedUrl,
            latestRevisionDate,
            coordinates,
            quality,
            rating,
            timeRating,
            kmlUrl,
            technicalRating,
            waterRating,
            riskRating,
            permits,
            rappelInfo,
            rappelCount,
            rappelLongest,
            months,
            shuttleTime,
            vehicle,
            minOverallTime,
            maxOverallTime,
            hikeLengthVu?.value,
            undefined,
            approachElevGainVu?.value,
            overallLengthVu?.value,
            undefined,
            undefined,
            exitElevGainVu?.value,
            minApproachTime,
            maxApproachTime,
            minDescentTime,
            maxDescentTime,
            minExitTime,
            maxExitTime,
            aka,
            betaSites,
            userVotes
        );
    }

    /** Column keys for batch INSERT in order; use with toDbRow() to build column arrays for unnest(). */
    static getDbInsertColumns(): readonly (keyof s.RopewikiPage.Insertable)[] {
        return [
            'pageId', 'name', 'region', 'url', 'rating', 'timeRating', 'kmlUrl',
            'technicalRating', 'waterRating', 'riskRating', 'permits', 'rappelInfo', 'rappelCount',
            'vehicle', 'quality', 'coordinates', 'rappelLongest', 'shuttleTime',
            'minOverallTime', 'maxOverallTime', 'overallLength', 'approachLength', 'approachElevGain',
            'descentLength', 'descentElevGain', 'exitLength', 'exitElevGain',
            'minApproachTime', 'maxApproachTime', 'minDescentTime', 'maxDescentTime',
            'minExitTime', 'maxExitTime', 'months', 'userVotes', 'latestRevisionDate', 'updatedAt', 'deletedAt',
        ];
    }

    /** PostgreSQL array type for each getDbInsertColumns() entry (for unnest casts). */
    static getDbInsertColumnTypes(): readonly string[] {
        return [
            'text', 'text', 'uuid', 'text', 'text', 'text', 'text',
            'text', 'text', 'text', 'text', 'text', 'integer',
            'text', 'numeric', 'jsonb', 'jsonb', 'jsonb',
            'jsonb', 'jsonb', 'numeric', 'numeric', 'numeric',
            'numeric', 'numeric', 'numeric', 'numeric',
            'jsonb', 'jsonb', 'jsonb', 'jsonb', 'jsonb', 'jsonb', 'jsonb', 'integer', 'timestamp', 'timestamp', 'timestamp',
        ];
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
            shuttleTime: this.shuttleTime ? JSON.stringify(this.shuttleTime) : null,
            minOverallTime: this.minOverallTime ? JSON.stringify(this.minOverallTime) : null,
            maxOverallTime: this.maxOverallTime ? JSON.stringify(this.maxOverallTime) : null,
            overallLength: this.overallLength ?? null,
            approachLength: this.approachLength ?? null,
            approachElevGain: this.approachElevGain ?? null,
            descentLength: this.descentLength ?? null,
            descentElevGain: this.descentElevGain ?? null,
            exitLength: this.exitLength ?? null,
            exitElevGain: this.exitElevGain ?? null,
            minApproachTime: this.minApproachTime ? JSON.stringify(this.minApproachTime) : null,
            maxApproachTime: this.maxApproachTime ? JSON.stringify(this.maxApproachTime) : null,
            minDescentTime: this.minDescentTime ? JSON.stringify(this.minDescentTime) : null,
            maxDescentTime: this.maxDescentTime ? JSON.stringify(this.maxDescentTime) : null,
            minExitTime: this.minExitTime ? JSON.stringify(this.minExitTime) : null,
            maxExitTime: this.maxExitTime ? JSON.stringify(this.maxExitTime) : null,
            months: this.months && this.months.length > 0 ? JSON.stringify(this.months) : null,
            userVotes: this.userVotes ?? null,
            latestRevisionDate: this.latestRevisionDate,
            updatedAt: now,
            deletedAt: null,
        };
    }

    static fromDbRow(row: s.RopewikiPage.JSONSelectable): RopewikiPage {
        // Parse JSON fields back to their original format
        const coordinates = row.coordinates as { lat: number; lon: number } | null;
        const rappelLongest = row.rappelLongest as { value: number; unit: string } | null;
        const shuttleTime = row.shuttleTime as { value: number; unit: string } | null;
        const minOverallTime = row.minOverallTime as { value: number; unit: string } | null;
        const maxOverallTime = row.maxOverallTime as { value: number; unit: string } | null;
        const parseNum = (v: string | null | undefined): number | undefined =>
            v != null && v !== '' ? Number(v) : undefined;
        const minApproachTime = row.minApproachTime as { value: number; unit: string } | null;
        const maxApproachTime = row.maxApproachTime as { value: number; unit: string } | null;
        const minDescentTime = row.minDescentTime as { value: number; unit: string } | null;
        const maxDescentTime = row.maxDescentTime as { value: number; unit: string } | null;
        const minExitTime = row.minExitTime as { value: number; unit: string } | null;
        const maxExitTime = row.maxExitTime as { value: number; unit: string } | null;
        const months = row.months as string[] | null;
        // aka is stored in RopewikiAkaName; not loaded here (default empty)
        const aka: string[] = [];

        // Create instance using constructor (betaSites no longer in DB; kept on class for use elsewhere)
        return new RopewikiPage(
            row.pageId,
            row.name,
            row.region,
            row.url,
            new Date(row.latestRevisionDate),
            coordinates ?? undefined,
            row.quality ?? undefined,
            row.rating ?? undefined,
            row.timeRating ?? undefined,
            row.kmlUrl ?? undefined,
            row.technicalRating ?? undefined,
            row.waterRating ?? undefined,
            row.riskRating ?? undefined,
            row.permits ?? undefined,
            row.rappelInfo ?? undefined,
            row.rappelCount ?? undefined,
            rappelLongest ?? undefined,
            months ?? [],
            shuttleTime ?? undefined,
            row.vehicle ?? undefined,
            minOverallTime ?? undefined,
            maxOverallTime ?? undefined,
            parseNum(row.overallLength as string | null),
            parseNum(row.approachLength as string | null),
            parseNum(row.approachElevGain as string | null),
            parseNum(row.descentLength as string | null),
            parseNum(row.descentElevGain as string | null),
            parseNum(row.exitLength as string | null),
            parseNum(row.exitElevGain as string | null),
            minApproachTime ?? undefined,
            maxApproachTime ?? undefined,
            minDescentTime ?? undefined,
            maxDescentTime ?? undefined,
            minExitTime ?? undefined,
            maxExitTime ?? undefined,
            aka ?? [],
            [], // betaSites migrated to RopewikiPageSiteLink; not read from DB
            row.userVotes ?? undefined,
            row.id
        );
    }

    static fromSQSEventRecord(record: SqsRecord): RopewikiPage {
        // Parse the body JSON string
        const pageData = JSON.parse(record.body) as { [key: string]: unknown };

        if (!pageData || !pageData.pageid) {
            throw new Error('Invalid SQS record body: missing page data or pageid');
        }

        // Parse JSON fields back to their original format
        const coordinates = pageData.coordinates as { lat: number; lon: number } | undefined;
        const rappelLongest = pageData.rappelLongest as { value: number; unit: string } | undefined;
        const shuttleTime = pageData.shuttleTime as { value: number; unit: string } | undefined;
        const minOverallTime = pageData.minOverallTime as { value: number; unit: string } | undefined;
        const maxOverallTime = pageData.maxOverallTime as { value: number; unit: string } | undefined;
        const minApproachTime = pageData.minApproachTime as { value: number; unit: string } | undefined;
        const maxApproachTime = pageData.maxApproachTime as { value: number; unit: string } | undefined;
        const minDescentTime = pageData.minDescentTime as { value: number; unit: string } | undefined;
        const maxDescentTime = pageData.maxDescentTime as { value: number; unit: string } | undefined;
        const minExitTime = pageData.minExitTime as { value: number; unit: string } | undefined;
        const maxExitTime = pageData.maxExitTime as { value: number; unit: string } | undefined;
        const num = (v: unknown): number | undefined =>
            typeof v === 'number' && !Number.isNaN(v) ? v : undefined;
        const months = pageData.months as string[] | undefined;
        const aka = pageData.aka as string[] | undefined;
        const betaSites = pageData.betaSites as string[] | undefined;

        // Convert latestRevisionDate string back to Date object if needed
        const latestRevisionDate = pageData.latestRevisionDate instanceof Date
            ? pageData.latestRevisionDate
            : new Date(pageData.latestRevisionDate as string);

        // Create instance using constructor
        return new RopewikiPage(
            pageData.pageid as string,
            pageData.name as string,
            (pageData.region as string) || '',
            (pageData.url as string) || '',
            latestRevisionDate,
            coordinates,
            pageData.quality as number | undefined,
            pageData.rating as string | undefined,
            pageData.timeRating as string | undefined,
            pageData.kmlUrl as string | undefined,
            pageData.technicalRating as string | undefined,
            pageData.waterRating as string | undefined,
            pageData.riskRating as string | undefined,
            pageData.permits as string | undefined,
            pageData.rappelInfo as string | undefined,
            pageData.rappelCount as number | undefined,
            rappelLongest,
            months || [],
            shuttleTime,
            pageData.vehicle as string | undefined,
            minOverallTime,
            maxOverallTime,
            num(pageData.overallLength),
            num(pageData.approachLength),
            num(pageData.approachElevGain),
            num(pageData.descentLength),
            num(pageData.descentElevGain),
            num(pageData.exitLength),
            num(pageData.exitElevGain),
            minApproachTime,
            maxApproachTime,
            minDescentTime,
            maxDescentTime,
            minExitTime,
            maxExitTime,
            aka || [],
            betaSites || [],
            pageData.userVotes as number | undefined,
            pageData.id as string | undefined
        );
    }

    // https://ropewiki.com/index.php?title=Special:Properties&limit=500&offset=0
    // Keys match API response printouts; values are the wiki property names from the link above
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
            shuttleTime: 'Has shuttle length',
            vehicle: 'Has vehicle type',
            minOverallTime: 'Has fastest typical time',
            maxOverallTime: 'Has slowest typical time',
            hikeLength: 'Has length of hike',  // → overallLength (numeric)
            overallLength: 'Has length',       // → descentLength (numeric)
            minApproachTime: 'Has fastest approach time',
            maxApproachTime: 'Has slowest approach time',
            minDescentTime: 'Has fastest descent time',
            maxDescentTime: 'Has slowest descent time',
            minExitTime: 'Has fastest exit time',
            maxExitTime: 'Has slowest exit time',
            approachElevGain: 'Has approach elevation gain',
            exitElevGain: 'Has exit elevation gain',
            url: 'Has url',
            aka: 'Has AKA',
            betaSites: 'Has BetaSites list',
            userVotes: 'Has total counter',
            latestRevisionDate: 'Modification date'
        };
    }

    /** Returns true if any length or elev gain property is defined and has a non-zero value. */
    needsLengthUpdates(): boolean {
        const values = [
            this.overallLength,
            this.approachLength,
            this.approachElevGain,
            this.descentLength,
            this.descentElevGain,
            this.exitLength,
            this.exitElevGain,
        ];
        return values.some((v) => v != null && v !== 0);
    }

    /** Sets all length and elev gain properties from the given LengthAndElevGain. */
    setLengthsAndElevGains(data: LengthAndElevGain): void {
        this.overallLength = data.overallLength ?? undefined;
        this.approachLength = data.approachLength ?? undefined;
        this.approachElevGain = data.approachElevGain ?? undefined;
        this.descentLength = data.descentLength ?? undefined;
        this.descentElevGain = data.descentElevGain ?? undefined;
        this.exitLength = data.exitLength ?? undefined;
        this.exitElevGain = data.exitElevGain ?? undefined;
    }
}

export default RopewikiPage;
