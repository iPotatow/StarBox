function privateIpv4(hostname) {
    const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!match)
        return false;
    const octets = match.slice(1).map(Number);
    if (octets.some((value) => value < 0 || value > 255))
        return true;
    const [a, b] = octets;
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
export function providerEndpoint(baseUrl) {
    let url;
    try {
        url = new URL(baseUrl);
    }
    catch {
        throw new Error("AI Base URL 格式无效");
    }
    if (url.protocol !== "https:")
        throw new Error("AI Base URL 必须使用 HTTPS");
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host.includes(":") || privateIpv4(host)) {
        throw new Error("AI Base URL 不允许本地或私网地址");
    }
    const path = url.pathname.replace(/\/+$/, "");
    url.pathname = path.endsWith("/chat/completions") ? path : `${path}/chat/completions`.replace(/\/+/g, "/");
    url.search = "";
    url.hash = "";
    return url;
}
const blockedHeaderNames = new Set(["host", "content-length", "connection", "transfer-encoding"]);
export const customHttpProviderAdapter = {
    id: "custom-http",
    buildEndpoint(config) {
        if (!config.baseUrl?.trim() || !config.apiKey?.trim() || !config.model?.trim()) {
            throw new Error("AI Provider 配置不完整");
        }
        return providerEndpoint(config.baseUrl.trim());
    },
    buildHeaders(config) {
        const headers = new Headers({
            "content-type": "application/json",
            authorization: `Bearer ${config.apiKey.trim()}`,
        });
        for (const [key, value] of Object.entries(config.headers ?? {})) {
            const normalized = key.trim().toLowerCase();
            if (!normalized || blockedHeaderNames.has(normalized) || normalized === "authorization")
                continue;
            if (typeof value === "string" && value.trim())
                headers.set(key.trim(), value.trim());
        }
        return headers;
    },
    buildBody(config, messages, jsonMode) {
        return {
            model: config.model.trim(),
            messages,
            temperature: 0.2,
            ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        };
    },
    readContent(payload) {
        const body = payload;
        const content = body.choices?.[0]?.message?.content?.trim();
        if (!content)
            throw new Error("Provider 返回了空响应");
        return content;
    },
};
export async function callProvider(config, messages, jsonMode = false, adapter = customHttpProviderAdapter) {
    const response = await fetch(adapter.buildEndpoint(config), {
        method: "POST",
        headers: adapter.buildHeaders(config),
        body: JSON.stringify(adapter.buildBody(config, messages, jsonMode)),
    });
    if (!response.ok) {
        let detail = "";
        try {
            const body = (await response.json());
            detail = typeof body.error === "string" ? body.error : body.error?.message || body.message || "";
        }
        catch {
            // Provider response body may not be JSON.
        }
        throw new Error(detail ? `Provider 错误：${detail.slice(0, 220)}` : `Provider 请求失败 (${response.status})`);
    }
    return adapter.readContent(await response.json());
}
