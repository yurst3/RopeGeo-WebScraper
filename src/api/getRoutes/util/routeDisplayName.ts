/**
 * Display name for GET /routes: when more than one non-deleted page is linked,
 * appends ` (+n)` where n is linkedPageCount - 1.
 */
export function routeDisplayName(name: string, linkedPageCount: number): string {
    if (linkedPageCount > 1) {
        return `${name} (+${linkedPageCount - 1})`;
    }
    return name;
}
