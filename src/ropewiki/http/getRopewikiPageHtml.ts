import fetchRopewiki from './fetchRopewiki';

const getRopewikiPageHtml = async (pageId: string): Promise<string> => {
    const url = `http://ropewiki.com/api.php?action=parse&pageid=${pageId}&format=json`;

    try {
        const response = await fetchRopewiki(url);

        if (response.ok) {
            const body = await response.json();
            return body.parse.text['*'];
        } else {
            throw new Error(`Error getting regions html: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        throw new Error(`Error getting regions html: ${error}`);
    }
}

export default getRopewikiPageHtml;