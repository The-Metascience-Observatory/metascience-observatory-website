/**
 * The "#" that appears beside a heading on hover and links to that section.
 *
 * Opt-in rather than automatic: `MarkdownContent` renders every docs page on
 * the site, and only some of them want their headings to advertise a link.
 */
export function HeadingAnchor({ id }: { id?: string }) {
  if (!id) return null;
  return (
    <a
      href={`#${id}`}
      aria-label="Link to this section"
      className="ml-2 align-middle text-base font-normal text-foreground/25 opacity-0 transition-opacity hover:text-foreground/60 focus:opacity-100 group-hover:opacity-100"
    >
      #
    </a>
  );
}
