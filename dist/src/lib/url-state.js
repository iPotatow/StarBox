function currentUrl() {
    if (typeof window === "undefined")
        return new URL("https://starbox.local/");
    const location = window.location;
    const href = typeof location.href === "string" && location.href ? location.href : "";
    if (href) {
        try {
            return new URL(href);
        }
        catch { /* fall through to structured fields */ }
    }
    const pathname = typeof location.pathname === "string" && location.pathname ? location.pathname : "/";
    const search = typeof location.search === "string" ? location.search : "";
    const hash = typeof location.hash === "string" ? location.hash : "";
    return new URL(`${pathname}${search}${hash}`, "https://starbox.local");
}
export function readQueryParam(name, fallback = "") {
    return currentUrl().searchParams.get(name) ?? fallback;
}
export function readQueryNumber(name, fallback) {
    const value = Number(readQueryParam(name));
    return Number.isFinite(value) && value > 0 ? value : fallback;
}
export function replaceQueryParams(values) {
    if (typeof window === "undefined")
        return;
    const url = currentUrl();
    for (const [key, value] of Object.entries(values)) {
        if (value === null || value === undefined || value === "" || value === false)
            url.searchParams.delete(key);
        else
            url.searchParams.set(key, String(value));
    }
    const replaceState = window.history?.replaceState;
    if (typeof replaceState === "function")
        replaceState.call(window.history, null, "", `${url.pathname}${url.search}${url.hash}`);
}
export function currentRelativeUrl() {
    const url = currentUrl();
    return `${url.pathname}${url.search}${url.hash}`;
}
