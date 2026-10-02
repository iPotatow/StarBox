import { Check as CheckIcon, Copy as CopyIcon } from "@phosphor-icons/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Children, isValidElement, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Button } from "./button";
import { useI18n } from "../../lib/i18n";
import { cn } from "@/lib/utils";

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

function githubHeadingSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

function hastText(node: any): string {
  if (!node) return "";
  if (node.type === "text") return String(node.value ?? "");
  if (node.type === "element" && node.tagName === "img") return String(node.properties?.alt ?? "");
  if (Array.isArray(node.children)) return node.children.map(hastText).join("");
  return "";
}

function rehypeGithubHeadingIds() {
  return (tree: any) => {
    const counts = new Map<string, number>();

    function visit(node: any) {
      if (node?.type === "element" && /^h[1-6]$/.test(node.tagName)) {
        const base = githubHeadingSlug(hastText(node)) || "section";
        const duplicateIndex = counts.get(base) ?? 0;
        counts.set(base, duplicateIndex + 1);
        node.properties ??= {};
        node.properties.id = duplicateIndex ? `${base}-${duplicateIndex}` : base;
      }
      if (Array.isArray(node?.children)) node.children.forEach(visit);
    }

    visit(tree);
  };
}

function markdownUrlTransform(url: string, key: string, node: any, linkBaseUrl?: string, imageBaseUrl?: string) {
  if (key === "href" && node?.tagName === "a") return resolveUrl(url, linkBaseUrl);
  if (key === "src" && node?.tagName === "img") return resolveUrl(url, imageBaseUrl, true);
  return "";
}

function reactNodeText(value: ReactNode): string {
  return Children.toArray(value).map((item) => {
    if (typeof item === "string" || typeof item === "number") return String(item);
    if (isValidElement(item)) return reactNodeText((item.props as { children?: ReactNode }).children);
    return "";
  }).join("");
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    if (!navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be unavailable in embedded or restricted browser contexts.
    }
  }

  return (
    <div className="relative min-w-0 max-w-full">
      <pre className="max-w-full overflow-x-hidden whitespace-pre-wrap break-words rounded-lg border border-border bg-secondary/45 p-4 pr-12 text-xs leading-6 text-foreground [overflow-wrap:anywhere]">
        <code data-language={language || undefined}>{code}</code>
      </pre>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="absolute right-2 top-2 bg-background/70"
        aria-label={copied ? t("已复制代码", "Code copied", "已複製程式碼") : t("复制代码", "Copy code", "複製程式碼")}
        onClick={() => void copyCode()}
      >
        {copied ? <CheckIcon className="size-3.5" aria-hidden="true" /> : <CopyIcon className="size-3.5" aria-hidden="true" />}
      </Button>
    </div>
  );
}

function heading(level: number) {
  const Tag = `h${level}` as any;
  const classes = level === 1 ? "text-2xl" : level === 2 ? "text-xl" : level === 3 ? "text-lg" : level === 4 ? "text-base" : "text-sm";
  return ({ node: _node, className, ...props }: any) => (
    <Tag
      className={cn(
        "mt-7 scroll-mt-4 border-b border-border/70 pb-2 first:mt-0 font-semibold tracking-tight text-foreground",
        level >= 4 && "border-b-0 pb-0",
        classes,
        className,
      )}
      {...props}
    />
  );
}

export function MarkdownContent({ content, className, linkBaseUrl, imageBaseUrl }: MarkdownContentProps) {
  return (
    <div className={cn("grid min-w-0 max-w-full gap-4 overflow-x-hidden break-words text-sm text-muted-foreground [overflow-wrap:anywhere] [&_img]:my-2 [&_img]:h-auto [&_img]:max-w-full", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeGithubHeadingIds]}
        skipHtml
        urlTransform={(url, key, node) => markdownUrlTransform(url, key, node, linkBaseUrl, imageBaseUrl)}
        components={{
          h1: heading(1),
          h2: heading(2),
          h3: heading(3),
          h4: heading(4),
          h5: heading(5),
          h6: heading(6),
          p: ({ node: _node, className: paragraphClassName, ...props }) => <p className={cn("leading-7", paragraphClassName)} {...props} />,
          a: ({ node: _node, href, className: linkClassName, ...props }) => {
            const anchor = href?.startsWith("#");
            return <a href={href} target={anchor ? undefined : "_blank"} rel={anchor ? undefined : "noreferrer"} className={cn("font-medium text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground", linkClassName)} {...props} />;
          },
          img: ({ node: _node, className: imageClassName, ...props }) => <img loading="lazy" className={cn("inline-block max-h-96 max-w-full rounded-md align-middle", imageClassName)} {...props} />,
          code: ({ node: _node, className: codeClassName, ...props }) => <code className={cn("break-words rounded bg-secondary px-1 py-0.5 font-mono text-[0.92em] text-foreground [overflow-wrap:anywhere]", codeClassName)} {...props} />,
          pre: ({ node: _node, children }) => {
            const child = Children.toArray(children)[0];
            const codeElement = isValidElement(child) ? child as ReactElement<{ className?: string; children?: ReactNode }> : null;
            const language = codeElement?.props.className?.match(/(?:^|\s)language-([^\s]+)/)?.[1];
            const code = reactNodeText(codeElement?.props.children ?? children).replace(/\n$/, "");
            return <CodeBlock code={code} language={language} />;
          },
          hr: ({ node: _node, className: hrClassName, ...props }) => <hr className={cn("my-5 border-border", hrClassName)} {...props} />,
          blockquote: ({ node: _node, className: quoteClassName, ...props }) => <blockquote className={cn("border-l-4 border-border pl-4 text-muted-foreground", quoteClassName)} {...props} />,
          ul: ({ node: _node, className: listClassName, ...props }) => <ul className={cn("grid gap-1.5 pl-5", listClassName?.includes("contains-task-list") ? "list-none pl-0" : "list-disc", listClassName)} {...props} />,
          ol: ({ node: _node, className: listClassName, ...props }) => <ol className={cn("grid list-decimal gap-1.5 pl-5", listClassName)} {...props} />,
          li: ({ node: _node, className: itemClassName, ...props }) => <li className={cn(itemClassName?.includes("task-list-item") && "flex items-start gap-2", itemClassName)} {...props} />,
          input: ({ node: _node, type, className: inputClassName, ...props }) => <input type={type} className={cn(type === "checkbox" && "mt-0.5 size-4 shrink-0 accent-primary", inputClassName)} {...props} />,
          table: ({ node: _node, className: tableClassName, ...props }) => (
            <div className="min-w-0 max-w-full overflow-x-hidden rounded-lg border border-border">
              <table className={cn("w-full table-fixed border-collapse text-left text-sm", tableClassName)} {...props} />
            </div>
          ),
          thead: ({ node: _node, className: headClassName, ...props }) => <thead className={cn("bg-secondary/55 text-foreground", headClassName)} {...props} />,
          tr: ({ node: _node, className: rowClassName, ...props }) => <tr className={cn("border-b border-border/70 last:border-b-0", rowClassName)} {...props} />,
          th: ({ node: _node, className: cellClassName, ...props }) => <th className={cn("break-words border-r border-border px-3 py-2 font-semibold [overflow-wrap:anywhere] last:border-r-0", cellClassName)} {...props} />,
          td: ({ node: _node, className: cellClassName, ...props }) => <td className={cn("break-words border-r border-border/70 px-3 py-2 align-top [overflow-wrap:anywhere] last:border-r-0", cellClassName)} {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
