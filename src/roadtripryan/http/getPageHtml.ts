const getPageHtml = async (url: string): Promise<string> => { 
    const response = await fetch(url);
    const body = await response.text();
    return body;
}
export default getPageHtml