"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Link2 } from "lucide-react";

/**
 * The link icon that appears beside a heading on hover. Clicking it copies the
 * section's full URL to the clipboard rather than navigating — the reader is
 * already at the heading they clicked, so the useful action is "give me
 * something to paste", not "scroll me here".
 *
 * It stays an `<a href="#id">` so it degrades to a plain anchor without JS and
 * so middle-click / right-click "copy link address" keep working.
 *
 * Opt-in rather than automatic: `MarkdownContent` renders every docs page on
 * the site, and only some of them want their headings to advertise a link.
 */
export function HeadingAnchor({ id }: { id?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    async (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (!id) return;
      event.preventDefault();
      // Split on "#" rather than rebuilding from origin+pathname so any query
      // string on the page survives into the copied link.
      const url = `${window.location.href.split("#")[0]}#${id}`;
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1500);
      } catch {
        // The clipboard API is unavailable over plain http and can be blocked
        // by browser settings; the address bar update below still leaves the
        // reader something to copy by hand.
      }
      window.history.replaceState(null, "", url);
    },
    [id]
  );

  if (!id) return null;

  const label = copied ? "Link copied" : "Copy link to this section";

  return (
    <a
      href={`#${id}`}
      onClick={copy}
      aria-label={label}
      title={label}
      className={`ml-2 inline-flex align-middle transition-opacity hover:text-foreground/60 focus:opacity-100 group-hover:opacity-100 ${
        copied ? "text-foreground/60 opacity-100" : "text-foreground/40 opacity-0"
      }`}
    >
      {copied ? (
        <Check className="h-4 w-4" aria-hidden />
      ) : (
        <Link2 className="h-4 w-4" aria-hidden />
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? "Link copied" : ""}
      </span>
    </a>
  );
}
