import Link from "next/link";

interface DocsBackLinkProps {
  href?: string;
  label?: string;
}

export function DocsBackLink({ href = "/docs", label = "return to docs" }: DocsBackLinkProps) {
  return (
    <Link
      href={href}
      className="text-sm text-foreground/60 hover:text-foreground transition-colors mb-4 inline-block"
    >
      &larr; {label}
    </Link>
  );
}
