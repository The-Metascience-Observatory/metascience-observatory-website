"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import "katex/dist/katex.min.css";
import { HeadingAnchor } from "@/components/HeadingAnchor";

// Email stored as char codes to prevent scraping from source
const _ec = [100,97,110,64,109,101,116,97,115,99,105,101,110,99,101,111,98,115,101,114,118,97,116,111,114,121,46,111,114,103];
function _de() { return _ec.map(c => String.fromCharCode(c)).join(""); }

interface MarkdownContentProps {
  content: string;
  /** Show a "#" beside each heading on hover, linking to that section. */
  anchorHeadings?: boolean;
}

export function MarkdownContent({ content, anchorHeadings = false }: MarkdownContentProps) {
  return (
    <article className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeSlug, rehypeKatex]}
        components={{
          h1: ({ children, id }) => (
            <h1 id={id} className="text-4xl font-bold mb-6 mt-0 text-foreground leading-tight scroll-mt-20">
              {children}
            </h1>
          ),
          // remark-gfm labels the footnote list with an sr-only "Footnotes" h2. Keep it hidden
          // for screen readers rather than restyling it as a visible section heading.
          h2: ({ children, id, className }) =>
            className?.includes("sr-only") ? (
              <h2 id={id} className="sr-only">
                {children}
              </h2>
            ) : (
              <h2 id={id} className="group text-2xl font-semibold mb-4 mt-10 text-foreground border-b border-border pb-2 scroll-mt-20">
                {children}
                {anchorHeadings && <HeadingAnchor id={id} />}
              </h2>
            ),
          h3: ({ children, id }) => (
            <h3 id={id} className="group text-xl font-semibold mb-3 mt-6 text-foreground scroll-mt-20">
              {children}
              {anchorHeadings && <HeadingAnchor id={id} />}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-4 leading-relaxed text-foreground/90">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="mb-4 ml-6 list-disc space-y-1 text-foreground/90">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 ml-6 list-decimal space-y-2 text-foreground/90">
              {children}
            </ol>
          ),
          li: ({ children, id }) => (
            // id is carried through so GFM footnote definitions remain jump targets
            <li id={id} className="leading-relaxed scroll-mt-20">
              {children}
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-foreground/80">
              {children}
            </em>
          ),
          hr: () => (
            <hr className="my-8 border-border" />
          ),
          // remark-gfm wraps footnote definitions in <section class="footnotes">. With the label
          // hidden, this rule is what separates the notes from the body text above them.
          section: ({ children, className }) =>
            className?.includes("footnotes") ? (
              <section className="mt-10 pt-6 border-t border-border text-sm text-foreground/80">
                {children}
              </section>
            ) : (
              <section className={className}>{children}</section>
            ),
          a: ({ href, children, id }) => {
            if (href === "mailto:OBFUSCATED_EMAIL") {
              const email = _de();
              return (
                <a
                  href={`mailto:${email}`}
                  className="text-blue-600 hover:text-blue-700 underline"
                >
                  {children}
                </a>
              );
            }
            return (
              <a
                href={href}
                // id is carried through so GFM footnote backrefs (↩) can jump back to the marker
                id={id}
                className="text-blue-600 hover:text-blue-700 underline"
                target={href?.startsWith("http") ? "_blank" : undefined}
                rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
              >
                {children}
              </a>
            );
          },
          code: ({ children }) => (
            <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
              {children}
            </code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary pl-4 my-4 italic text-foreground/80">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-6">
              <table className="min-w-full border-collapse border border-border">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody>
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="border-b border-border">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 text-left font-semibold text-foreground border border-border">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 text-foreground/90 border border-border">
              {children}
            </td>
          ),
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt || ""}
              className="my-4 max-w-full rounded shadow"
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
