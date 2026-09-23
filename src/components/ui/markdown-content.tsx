import { Check as CheckIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface MarkdownContentProps {
  content: string;
  className?: string;
  linkBaseUrl?: string;
  imageBaseUrl?: string;
}

function resolveUrl(value: string, baseUrl?: string, image = false) {
  const target = value.trim().replace(/^<|>$/g, "");
  if (!target) return "";
  if (target.startsWith("#")) return image ? "" : target;
  if (!image && /^(mailto:|tel:)/i.test(target)) return target;
  try {
    const url = baseUrl ? new URL(target, baseUrl) : new URL(target);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function parseDestination(raw: string) {
  const match = raw.trim().match(/^(\S+?)(?:\s+["'].*["'])?$/);
  return match?.[1] ?? raw.trim();
}

function inline(text: string, linkBaseUrl?: string, imageBaseUrl?: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(\[!\[[^\]]*\]\([^)]+\)\]\([^)]+\)|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|~~[^~]+~~|(?<!\*)\*[^*\n]+\*(?!\*)|<br\s*\/?>|<\/?[A-Za-z][^>]*>)/gi;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];

    if (/^<br\s*\/?>$/i.test(token)) {
      parts.push(<br key={key++} />);
      last = pattern.lastIndex;
      continue;
    }
    if (/^<\/?[A-Za-z][^>]*>$/.test(token)) {
      // GitHub README HTML is intentionally not executed. Strip inline tags instead
      // of leaking their source text into headings and paragraphs.
      last = pattern.lastIndex;
      continue;
    }

    const linkedImage = token.match(/^\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)$/);
    if (linkedImage) {
      const imageUrl = resolveUrl(parseDestination(linkedImage[2]), imageBaseUrl, true);
      const href = resolveUrl(parseDestination(linkedImage[3]), linkBaseUrl);
      if (imageUrl) {
        const image = <img src={imageUrl} alt={linkedImage[1]} loading="lazy" className="inline-block max-h-28 max-w-full align-middle" />;
        parts.push(href ? <a key={key++} href={href} target="_blank" rel="noreferrer">{image}</a> : <span key={key++}>{image}</span>);
      } else parts.push(token);
      last = pattern.lastIndex;
      continue;
    }

    const image = token.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      const src = resolveUrl(parseDestination(image[2]), imageBaseUrl, true);
      parts.push(src ? <img key={key++} src={src} alt={image[1]} loading="lazy" className="inline-block max-h-96 max-w-full rounded-md align-middle" /> : token);
      last = pattern.lastIndex;
      continue;
    }

    const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const href = resolveUrl(parseDestination(link[2]), linkBaseUrl);
      parts.push(href ? <a key={key++} href={href} target={href.startsWith("#") ? undefined : "_blank"} rel={href.startsWith("#") ? undefined : "noreferrer"} className="font-medium text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground">{link[1]}</a> : token);
      last = pattern.lastIndex;
      continue;
    }

    if (token.startsWith("`")) parts.push(<code key={key++} className="rounded bg-secondary px-1 py-0.5 font-mono text-[0.92em] text-foreground">{token.slice(1, -1)}</code>);
    else if (token.startsWith("**")) parts.push(<strong key={key++} className="font-semibold text-foreground">{token.slice(2, -2)}</strong>);
    else if (token.startsWith("~~")) parts.push(<del key={key++}>{token.slice(2, -2)}</del>);
    else if (token.startsWith("*")) parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    else parts.push(token);
    last = pattern.lastIndex;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function splitTableRow(line: string) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

function isTableDivider(line: string) {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isBlockStart(lines: string[], index: number) {
  const line = lines[index] ?? "";
  if (!line.trim()) return true;
  if (/^```/.test(line) || /^(#{1,6})\s+/.test(line) || /^[-*_]{3,}\s*$/.test(line)) return true;
  if (/^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line) || /^>\s?/.test(line)) return true;
  return index + 1 < lines.length && line.includes("|") && isTableDivider(lines[index + 1]);
}

export function MarkdownContent({ content, className, linkBaseUrl, imageBaseUrl }: MarkdownContentProps) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const nodes: ReactNode[] = [];
  let index = 0;
  let key = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    if (/^<!--/.test(line.trim())) {
      while (index < lines.length && !lines[index].includes("-->")) index += 1;
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) { code.push(lines[index]); index += 1; }
      if (index < lines.length) index += 1;
      nodes.push(<pre key={key++} className="overflow-x-auto rounded-lg border border-border bg-secondary/45 p-4 text-xs leading-6 text-foreground"><code data-language={language || undefined}>{code.join("\n")}</code></pre>);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const Tag = `h${level}` as any;
      const classes = level === 1 ? "text-2xl" : level === 2 ? "text-xl" : level === 3 ? "text-lg" : level === 4 ? "text-base" : "text-sm";
      nodes.push(<Tag key={key++} className={cn("mt-7 scroll-mt-4 border-b border-border/70 pb-2 first:mt-0 font-semibold tracking-tight text-foreground", level >= 4 && "border-b-0 pb-0", classes)}>{inline(heading[2].replace(/\s+#+$/, ""), linkBaseUrl, imageBaseUrl)}</Tag>);
      index += 1;
      continue;
    }

    if (/^[-*_]{3,}\s*$/.test(line.trim())) {
      nodes.push(<hr key={key++} className="my-5 border-border" />);
      index += 1;
      continue;
    }

    if (index + 1 < lines.length && line.includes("|") && isTableDivider(lines[index + 1])) {
      const header = splitTableRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].trim() && lines[index].includes("|")) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      nodes.push(<div key={key++} className="overflow-x-auto rounded-lg border border-border"><table className="w-full border-collapse text-left text-sm"><thead className="bg-secondary/55 text-foreground"><tr>{header.map((cell, cellIndex) => <th key={cellIndex} className="border-b border-r border-border px-3 py-2 font-semibold last:border-r-0">{inline(cell, linkBaseUrl, imageBaseUrl)}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-border/70 last:border-b-0">{header.map((_, cellIndex) => <td key={cellIndex} className="border-r border-border/70 px-3 py-2 align-top last:border-r-0">{inline(row[cellIndex] ?? "", linkBaseUrl, imageBaseUrl)}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }

    if (/^[-*+]\s+/.test(line)) {
      const items: Array<{ text: string; checked?: boolean }> = [];
      while (index < lines.length && /^[-*+]\s+/.test(lines[index])) {
        const raw = lines[index].replace(/^[-*+]\s+/, "");
        const task = raw.match(/^\[([ xX])\]\s+(.*)$/);
        items.push(task ? { text: task[2], checked: task[1].toLowerCase() === "x" } : { text: raw });
        index += 1;
      }
      const taskList = items.some((item) => item.checked !== undefined);
      nodes.push(<ul key={key++} className={cn("grid gap-1.5", taskList ? "list-none pl-0" : "list-disc pl-5")}>{items.map((item, itemIndex) => <li key={itemIndex} className={taskList ? "flex items-start gap-2" : undefined}>{item.checked !== undefined ? <span aria-hidden="true" className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded border text-[10px]", item.checked ? "border-primary bg-primary text-primary-foreground" : "border-input")}>{item.checked ? <CheckIcon className="size-3" /> : null}</span> : null}<span>{inline(item.text, linkBaseUrl, imageBaseUrl)}</span></li>)}</ul>);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) { items.push(lines[index].replace(/^\d+\.\s+/, "")); index += 1; }
      nodes.push(<ol key={key++} className="grid list-decimal gap-1.5 pl-5">{items.map((item, itemIndex) => <li key={itemIndex}>{inline(item, linkBaseUrl, imageBaseUrl)}</li>)}</ol>);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) { quote.push(lines[index].replace(/^>\s?/, "")); index += 1; }
      nodes.push(<blockquote key={key++} className="border-l-4 border-border pl-4 text-muted-foreground">{quote.map((item, quoteIndex) => <span key={quoteIndex}>{inline(item, linkBaseUrl, imageBaseUrl)}{quoteIndex < quote.length - 1 ? <br /> : null}</span>)}</blockquote>);
      continue;
    }

    if (/^<[^>]+>/.test(line.trim())) {
      const stripped = line.replace(/<[^>]+>/g, "").trim();
      if (stripped) nodes.push(<p key={key++} className="leading-7">{inline(stripped, linkBaseUrl, imageBaseUrl)}</p>);
      index += 1;
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length && !isBlockStart(lines, index)) { paragraph.push(lines[index]); index += 1; }
    nodes.push(<p key={key++} className="leading-7">{inline(paragraph.join(" "), linkBaseUrl, imageBaseUrl)}</p>);
  }

  return <div className={cn("grid gap-4 break-words text-sm text-muted-foreground [&_img]:my-2", className)}>{nodes}</div>;
}
