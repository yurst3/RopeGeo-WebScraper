import httpRequest from "../../helpers/httpRequest";

const getPageHtml = async (url: string): Promise<string> => { 
    try { 
        const response = await httpRequest(url);
        const body = await response.text();

        return body;
    }
    catch (error) {
        throw new Error(`Error getting pageHtml from ${url} : ${error}`)
    }
}
export default getPageHtml