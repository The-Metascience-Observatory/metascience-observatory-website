import Link from "next/link";

export function DocsBackLink() {
  return (
    <Link
      href="/docs"
      className="text-sm text-foreground/60 hover:text-foreground transition-colors mb-4 inline-block"
    >
      &larr; return to docs
    </Link>
  );
}
