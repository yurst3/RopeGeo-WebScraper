const getPageHtml = async (url: string): Promise<string> => { 
    try { 
        const response = await fetch(url);
        if (response.ok) {
            const body = await response.text();
            return body;
        }
        else {
            throw new Error(`${response.status} error: ${await response.text()}`)
        }
    }
    catch (error) {
        throw new Error(`Error getting pageHtml from ${url} : ${error}`)
    }
}
export default getPageHtml