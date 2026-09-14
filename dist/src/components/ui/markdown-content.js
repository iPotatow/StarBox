import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "../../lib/cn.js";
function resolveUrl(value, baseUrl, image = false) {
    const target = value.trim().replace(/^<|>$/g, "");
    if (!target)
        return "";
    if (target.startsWith("#"))
        return image ? "" : target;
    if (!image && /^(mailto:|tel:)/i.test(target))
        return target;
    try {
        const url = baseUrl ? new URL(target, baseUrl) : new URL(target);
        if (url.protocol !== "http:" && url.protocol !== "https:")
            return "";
        return url.toString();
    }
    catch {
        return "";
    }
}
function parseDestination(raw) {
    const match = raw.trim().match(/^(\S+?)(?:\s+["'].*["'])?$/);
    return match?.[1] ?? raw.trim();
}
function inline(text, linkBaseUrl, imageBaseUrl) {
    const parts = [];
    const pattern = /(\[!\[[^\]]*\]\([^)]+\)\]\([^)]+\)|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|~~[^~]+~~|(?<!\*)\*[^*\n]+\*(?!\*))/g;
    let last = 0;
    let match;
    let key = 0;
    while ((match = pattern.exec(text))) {
        if (match.index > last)
            parts.push(text.slice(last, match.index));
        const token = match[0];
        const linkedImage = token.match(/^\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)$/);
        if (linkedImage) {
            const imageUrl = resolveUrl(parseDestination(linkedImage[2]), imageBaseUrl, true);
            const href = resolveUrl(parseDestination(linkedImage[3]), linkBaseUrl);
            if (imageUrl) {
                const image = _jsx("img", { src: imageUrl, alt: linkedImage[1], loading: "lazy", className: "inline-block max-h-28 max-w-full align-middle" });
                parts.push(href ? _jsx("a", { href: href, target: "_blank", rel: "noreferrer", children: image }, key++) : _jsx("span", { children: image }, key++));
            }
            else
                parts.push(token);
            last = pattern.lastIndex;
            continue;
        }
        const image = token.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        if (image) {
            const src = resolveUrl(parseDestination(image[2]), imageBaseUrl, true);
            parts.push(src ? _jsx("img", { src: src, alt: image[1], loading: "lazy", className: "inline-block max-h-96 max-w-full rounded-md align-middle" }, key++) : token);
            last = pattern.lastIndex;
            continue;
        }
        const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
            const href = resolveUrl(parseDestination(link[2]), linkBaseUrl);
            parts.push(href ? _jsx("a", { href: href, target: href.startsWith("#") ? undefined : "_blank", rel: href.startsWith("#") ? undefined : "noreferrer", className: "font-medium text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground", children: link[1] }, key++) : token);
            last = pattern.lastIndex;
            continue;
        }
        if (token.startsWith("`"))
            parts.push(_jsx("code", { className: "rounded bg-secondary px-1 py-0.5 font-mono text-[0.92em] text-foreground", children: token.slice(1, -1) }, key++));
        else if (token.startsWith("**"))
            parts.push(_jsx("strong", { className: "font-semibold text-foreground", children: token.slice(2, -2) }, key++));
        else if (token.startsWith("~~"))
            parts.push(_jsx("del", { children: token.slice(2, -2) }, key++));
        else if (token.startsWith("*"))
            parts.push(_jsx("em", { children: token.slice(1, -1) }, key++));
        else
            parts.push(token);
        last = pattern.lastIndex;
    }
    if (last < text.length)
        parts.push(text.slice(last));
    return parts;
}
function splitTableRow(line) {
    return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}
function isTableDivider(line) {
    const cells = splitTableRow(line);
    return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}
function isBlockStart(lines, index) {
    const line = lines[index] ?? "";
    if (!line.trim())
        return true;
    if (/^```/.test(line) || /^(#{1,6})\s+/.test(line) || /^[-*_]{3,}\s*$/.test(line))
        return true;
    if (/^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line) || /^>\s?/.test(line))
        return true;
    return index + 1 < lines.length && line.includes("|") && isTableDivider(lines[index + 1]);
}
export function MarkdownContent({ content, className, linkBaseUrl, imageBaseUrl }) {
    const lines = content.replace(/\r\n/g, "\n").split("\n");
    const nodes = [];
    let index = 0;
    let key = 0;
    while (index < lines.length) {
        const line = lines[index];
        if (!line.trim()) {
            index += 1;
            continue;
        }
        if (/^<!--/.test(line.trim())) {
            while (index < lines.length && !lines[index].includes("-->"))
                index += 1;
            index += 1;
            continue;
        }
        if (line.startsWith("```")) {
            const language = line.slice(3).trim();
            const code = [];
            index += 1;
            while (index < lines.length && !lines[index].startsWith("```")) {
                code.push(lines[index]);
                index += 1;
            }
            if (index < lines.length)
                index += 1;
            nodes.push(_jsx("pre", { className: "overflow-x-auto rounded-lg border border-border bg-secondary/45 p-4 text-xs leading-6 text-foreground", children: _jsx("code", { "data-language": language || undefined, children: code.join("\n") }) }, key++));
            continue;
        }
        const heading = line.match(/^(#{1,6})\s+(.+)$/);
        if (heading) {
            const level = heading[1].length;
            const Tag = `h${level}`;
            const classes = level === 1 ? "text-2xl" : level === 2 ? "text-xl" : level === 3 ? "text-lg" : level === 4 ? "text-base" : "text-sm";
            nodes.push(_jsx(Tag, { className: cn("mt-7 scroll-mt-4 border-b border-border/70 pb-2 first:mt-0 font-semibold tracking-tight text-foreground", level >= 4 && "border-b-0 pb-0", classes), children: inline(heading[2].replace(/\s+#+$/, ""), linkBaseUrl, imageBaseUrl) }, key++));
            index += 1;
            continue;
        }
        if (/^[-*_]{3,}\s*$/.test(line.trim())) {
            nodes.push(_jsx("hr", { className: "my-5 border-border" }, key++));
            index += 1;
            continue;
        }
        if (index + 1 < lines.length && line.includes("|") && isTableDivider(lines[index + 1])) {
            const header = splitTableRow(line);
            const rows = [];
            index += 2;
            while (index < lines.length && lines[index].trim() && lines[index].includes("|")) {
                rows.push(splitTableRow(lines[index]));
                index += 1;
            }
            nodes.push(_jsx("div", { className: "overflow-x-auto rounded-lg border border-border", children: _jsxs("table", { className: "w-full border-collapse text-left text-sm", children: [_jsx("thead", { className: "bg-secondary/55 text-foreground", children: _jsx("tr", { children: header.map((cell, cellIndex) => _jsx("th", { className: "border-b border-r border-border px-3 py-2 font-semibold last:border-r-0", children: inline(cell, linkBaseUrl, imageBaseUrl) }, cellIndex)) }) }), _jsx("tbody", { children: rows.map((row, rowIndex) => _jsx("tr", { className: "border-b border-border/70 last:border-b-0", children: header.map((_, cellIndex) => _jsx("td", { className: "border-r border-border/70 px-3 py-2 align-top last:border-r-0", children: inline(row[cellIndex] ?? "", linkBaseUrl, imageBaseUrl) }, cellIndex)) }, rowIndex)) })] }) }, key++));
            continue;
        }
        if (/^[-*+]\s+/.test(line)) {
            const items = [];
            while (index < lines.length && /^[-*+]\s+/.test(lines[index])) {
                const raw = lines[index].replace(/^[-*+]\s+/, "");
                const task = raw.match(/^\[([ xX])\]\s+(.*)$/);
                items.push(task ? { text: task[2], checked: task[1].toLowerCase() === "x" } : { text: raw });
                index += 1;
            }
            const taskList = items.some((item) => item.checked !== undefined);
            nodes.push(_jsx("ul", { className: cn("space-y-1.5", taskList ? "list-none pl-0" : "list-disc pl-5"), children: items.map((item, itemIndex) => _jsxs("li", { className: taskList ? "flex items-start gap-2" : undefined, children: [item.checked !== undefined ? _jsx("span", { "aria-hidden": "true", className: cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded border text-[10px]", item.checked ? "border-primary bg-primary text-primary-foreground" : "border-input"), children: item.checked ? "✓" : "" }) : null, _jsx("span", { children: inline(item.text, linkBaseUrl, imageBaseUrl) })] }, itemIndex)) }, key++));
            continue;
        }
        if (/^\d+\.\s+/.test(line)) {
            const items = [];
            while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
                items.push(lines[index].replace(/^\d+\.\s+/, ""));
                index += 1;
            }
            nodes.push(_jsx("ol", { className: "list-decimal space-y-1.5 pl-5", children: items.map((item, itemIndex) => _jsx("li", { children: inline(item, linkBaseUrl, imageBaseUrl) }, itemIndex)) }, key++));
            continue;
        }
        if (/^>\s?/.test(line)) {
            const quote = [];
            while (index < lines.length && /^>\s?/.test(lines[index])) {
                quote.push(lines[index].replace(/^>\s?/, ""));
                index += 1;
            }
            nodes.push(_jsx("blockquote", { className: "border-l-4 border-border pl-4 text-muted-foreground", children: quote.map((item, quoteIndex) => _jsxs("span", { children: [inline(item, linkBaseUrl, imageBaseUrl), quoteIndex < quote.length - 1 ? _jsx("br", {}) : null] }, quoteIndex)) }, key++));
            continue;
        }
        if (/^<[^>]+>/.test(line.trim())) {
            const stripped = line.replace(/<[^>]+>/g, "").trim();
            if (stripped)
                nodes.push(_jsx("p", { className: "leading-7", children: inline(stripped, linkBaseUrl, imageBaseUrl) }, key++));
            index += 1;
            continue;
        }
        const paragraph = [line];
        index += 1;
        while (index < lines.length && !isBlockStart(lines, index)) {
            paragraph.push(lines[index]);
            index += 1;
        }
        nodes.push(_jsx("p", { className: "leading-7", children: inline(paragraph.join(" "), linkBaseUrl, imageBaseUrl) }, key++));
    }
    return _jsx("div", { className: cn("space-y-4 break-words text-sm text-muted-foreground [&_img]:my-2", className), children: nodes });
}
