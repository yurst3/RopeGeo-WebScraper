export type MainEvent = {
    processPages: boolean;
    processRoutes: boolean;
};

export function isMainEvent(event: unknown): event is MainEvent {
    return (
        typeof event === 'object' &&
        event !== null &&
        'processPages' in event &&
        'processRoutes' in event &&
        typeof (event as MainEvent).processPages === 'boolean' &&
        typeof (event as MainEvent).processRoutes === 'boolean'
    );
}
