import Link from "next/link";
import { toolFamilies, familyHref, type ToolFamily } from "./tools";
import { ToolTile, type IconStyle } from "./ToolTile";

export type { IconStyle };

/** How the pile is drawn. */
export type StackVariant = "fanned" | "boxed" | "isometric";

function TileGrid({ family, iconStyle }: { family: ToolFamily; iconStyle: IconStyle }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {family.tools.map((tool) => (
        <ToolTile key={tool.slug} tool={tool} iconStyle={iconStyle} familySlug={family.slug} />
      ))}
    </div>
  );
}

function FamilyHeading({ family }: { family: ToolFamily }) {
  return (
    <Link
      href={familyHref(family)}
      className="font-clarendon text-base font-semibold leading-snug text-foreground hover:text-primary"
    >
      {family.title}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

/** Layered offset cards behind the face — the literal "pile". */
function FannedStack({ family, iconStyle }: { family: ToolFamily; iconStyle: IconStyle }) {
  return (
    <div className="relative pb-2 pr-2">
      <span
        aria-hidden
        className="absolute inset-0 translate-x-2 translate-y-2 rotate-[1.2deg] rounded-lg border border-border bg-white"
      />
      <span
        aria-hidden
        className="absolute inset-0 translate-x-1 translate-y-1 -rotate-[0.8deg] rounded-lg border border-border bg-white"
      />
      <div className="relative rounded-lg border border-border bg-white p-4">
        <FamilyHeading family={family} />
        <div className="mt-3">
          <TileGrid family={family} iconStyle={iconStyle} />
        </div>
      </div>
    </div>
  );
}

/** A plain bordered box — the most scannable option, and the one in use. */
function BoxedStack({ family, iconStyle }: { family: ToolFamily; iconStyle: IconStyle }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <FamilyHeading family={family} />
      <div className="mt-3">
        <TileGrid family={family} iconStyle={iconStyle} />
      </div>
    </div>
  );
}

/** Slab count proportional to family size, tools listed beside the pile. */
function IsometricStack({ family, iconStyle }: { family: ToolFamily; iconStyle: IconStyle }) {
  const slabs = Math.min(family.tools.length, 10);
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <FamilyHeading family={family} />
      <div className="mt-3 flex items-end gap-4">
        <div
          aria-hidden
          className="relative shrink-0"
          style={{ width: "4.5rem", height: `${slabs * 6 + 20}px` }}
        >
          {Array.from({ length: slabs }).map((_, i) => (
            <span
              key={i}
              className="absolute left-0 h-5 w-16 rounded-[2px] border border-border bg-primary/10"
              style={{
                bottom: `${i * 6}px`,
                transform: "skewX(-38deg) scaleY(0.55)",
                transformOrigin: "bottom left",
              }}
            />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <TileGrid family={family} iconStyle={iconStyle} />
        </div>
      </div>
    </div>
  );
}

const VARIANTS = {
  fanned: FannedStack,
  boxed: BoxedStack,
  isometric: IsometricStack,
} as const;

// ---------------------------------------------------------------------------

export function ToolStacks({
  variant = "boxed",
  iconStyle = "monogram",
  families = toolFamilies,
}: {
  variant?: StackVariant;
  iconStyle?: IconStyle;
  families?: ToolFamily[];
}) {
  const Stack = VARIANTS[variant];
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {families.map((family) => (
        <Stack key={family.slug} family={family} iconStyle={iconStyle} />
      ))}
    </div>
  );
}
