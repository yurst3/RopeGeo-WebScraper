const parseCanyonsPage = async (pageHtml: string): Promise<void> => {
    // Match the tripTypes1 variable assignment and extract the JSON string value
    // Pattern matches: var tripTypes1 = "..." or ;var tripTypes1 = "..."
    const regex = /(?:var|;var)\s+tripTypes1\s=\s"((?:[^"\\]|\\.)*)";/s;

    const match = pageHtml.match(regex);

    if (!match || !match[1]) {
        throw new Error('Could not find tripTypes1 variable in HTML');
    }

    // The captured group contains the JSON string with escaped quotes
    // We need to unescape it before parsing
    const jsonString = match[1]
        .replace(/\"/g, '"')  // Unescape quotes
        .replace(/\n/g, '\n') // Unescape newlines
        .replace(/\r/g, '\r') // Unescape carriage returns
        .replace(/\t/g, '\t') // Unescape tabs
        .replace(/\\\\/g, '\\'); // Unescape backslashes

    // Parse the JSON string
    const parsed = JSON.parse(jsonString);

    // return parsed as unknown[];
}

export default parseCanyonsPage;