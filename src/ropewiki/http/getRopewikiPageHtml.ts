import httpRequest from '../../helpers/httpRequest';

const getRopewikiPageHtml = async (pageId: string): Promise<string> => {
    const url = `http://ropewiki.com/api.php?action=parse&pageid=${pageId}&format=json`;

    try {
        const response = await httpRequest(url);
        const body = await response.json();
        return body.parse.text['*'];
    } catch (error) {
        throw new Error(`Error getting regions html: ${error}`);
    }
}

export default getRopewikiPageHtml;