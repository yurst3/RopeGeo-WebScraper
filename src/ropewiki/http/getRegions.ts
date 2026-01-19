import { RopewikiRegion } from '../types/region';

const encode = (input: string) => {
    return encodeURIComponent(input).replace(/%/g, '-');
}

const getRegions = async (): Promise<RopewikiRegion[]> => {
    try {
        const url = new URL('https://ropewiki.com/index.php');
        url.searchParams.append('title', 'Special:Ask');

        const apiRequestPrintouts: {[name: string]: string} = RopewikiRegion.getApiRequestPrintouts();
        const propertiesEncoded = Object.entries(apiRequestPrintouts)
            .map(([a, b]) => `${encode(b)}=${encode(a)}`)
            .join('/-3F');

        url.searchParams.append(
            'x',
            `-5B-5BCategory:Regions-5D-5D/-3F${propertiesEncoded}`,
        );
        url.searchParams.append('format', 'json');
        url.searchParams.append('limit', '2000');

        const response = await fetch(url);

        if (response.ok) {
            const body = await response.json();

            return Object.entries(body.results).map(([name, result]) => RopewikiRegion.fromResponseBody(name, result));
        } else {
            throw new Error(`Error getting regions: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        throw new Error(`Error getting regions: ${error}`);
    }
}

export default getRegions;