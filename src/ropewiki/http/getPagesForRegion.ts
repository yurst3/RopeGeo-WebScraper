import { httpRequest } from 'ropegeo-common/helpers';
import RopewikiPage from '../types/page';

const RETRIES = 3;

const encode = (input: string) => {
    return encodeURIComponent(input).replace(/%/g, '-');
}

const getPagesForRegion = async (
    region: string,
    offset: number,
    limit: number,
    regionNameIds: {[name: string]: string}
): Promise<RopewikiPage[]> => {
    if (limit > 2000) {
        throw new Error(`Limit must be less than or equal to 2000, got ${limit}`);
    }
    if (offset > 5000) {
        throw new Error(`Offset must be less than or equal to 5000, got ${offset}`);
    }

    try {
        const url = new URL('https://ropewiki.com/index.php');
        url.searchParams.append('title', 'Special:Ask');

        const apiRequestPrintouts = RopewikiPage.getApiRequestPrintouts();
        const propertiesEncoded = Object.entries(apiRequestPrintouts)
            .map(([a, b]) => `${encode(b)}=${encode(a)}`)
            .join('/-3F');

        url.searchParams.append(
            'x',
            `-5B-5BCategory:Canyons-5D-5D-5B-5BLocated-20in-20region.Located-20in-20regions::X-7C-7C${region}-5D-5D/-3F${propertiesEncoded}`,
        );
        url.searchParams.append('format', 'json');
        url.searchParams.append('limit', limit.toString());
        url.searchParams.append('offset', offset.toString());

        const response = await httpRequest(url, RETRIES);
        const body = await response.json();

        return Object.values(body.results).map((result: unknown) => RopewikiPage.fromResponseBody(result, regionNameIds));
    } catch (error) {
        throw new Error(`Error getting pages info for region ${region} offset ${offset} limit ${limit}: ${error}`);
    }
}

export default getPagesForRegion;
