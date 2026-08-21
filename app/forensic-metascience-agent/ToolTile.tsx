"use client";

import Link from "next/link";
import {
  FileSearch,
  Grid3x3,
  Sigma,
  Calculator,
  Copy,
  Ruler,
  Image as ImageIcon,
  FlaskConical,
  type LucideIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipPortal,
  TooltipArrow,
} from "@/components/ui/tooltip";
import { toolHref, type Tool } from "./tools";

/** How each tool is drawn inside a stack. */
export type IconStyle = "monogram" | "lucide" | "icon-label" | "dot";

// One lucide glyph per FAMILY, not per tool: 58 forensic checks do not map onto
// 58 recognisable icons, and repeated glyphs across a grid read as a bug.
const FAMILY_ICON: Record<string, LucideIcon> = {
  ingestion: FileSearch,
  granularity: Grid3x3,
  recomputation: Calculator,
  "table-arithmetic": Sigma,
  similarity: Copy,
  "design-and-inference": Ruler,
  heuristics: FlaskConical,
  "image-and-text": ImageIcon,
  "r-ground-truth": FlaskConical,
};

const TILE_BASE =
  "relative flex items-center justify-center rounded border border-border bg-white " +
  "text-foreground/70 transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1";

export function ToolTile({
  tool,
  iconStyle,
  familySlug,
}: {
  tool: Tool;
  iconStyle: IconStyle;
  familySlug: string;
}) {
  const Icon = FAMILY_ICON[familySlug] ?? FlaskConical;

  const size =
    iconStyle === "dot"
      ? "h-6 w-6"
      : iconStyle === "icon-label"
        ? "h-14 w-14 flex-col gap-1"
        : "h-8 px-2";

  return (
    <Tooltip delayDuration={120} disableHoverableContent>
      <TooltipTrigger asChild>
        <Link
          href={toolHref(tool)}
          aria-label={`${tool.name} — ${tool.does}`}
          className={`${TILE_BASE} ${size}`}
        >
          {iconStyle === "monogram" && (
            <span className="whitespace-nowrap text-[10px] font-semibold leading-none tracking-tight">
              {tool.monogram}
            </span>
          )}
          {iconStyle === "lucide" && <Icon className="h-4 w-4" aria-hidden />}
          {iconStyle === "icon-label" && (
            <>
              <Icon className="h-4 w-4" aria-hidden />
              <span className="text-[9px] font-medium leading-none tracking-tight">
                {tool.monogram}
              </span>
            </>
          )}
          {iconStyle === "dot" && <span className="sr-only">{tool.name}</span>}
          {tool.quarantined && (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-amber-500"
            />
          )}
        </Link>
      </TooltipTrigger>

      <TooltipPortal>
        {/*
          Right of the tile, not below it, and pushed well clear of the pointer:
          a large Linux cursor sits over the tile and covered the first line of
          the tooltip. The arrow occupies part of the gap, so the panel itself
          starts further out still.

          `pointer-events-none` + `disableHoverableContent` are NOT cosmetic. The
          panel is ~300px wide and opens over the tiles to its right, so without
          them the cursor lands on the PANEL when you move right: it holds itself
          open, the tiles underneath never receive a hover, and the tooltip
          appears frozen on whichever tile you touched first.
        */}
        <TooltipContent
          side="right"
          align="center"
          sideOffset={18}
          className="pointer-events-none max-w-[19rem] px-3.5 py-3 shadow-xl"
        >
          <TooltipArrow
            className="fill-white stroke-border [stroke-width:1px]"
            width={13}
            height={7}
          />
          <p className="font-clarendon text-sm font-semibold leading-snug text-foreground">
            {tool.name}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-foreground/75">{tool.does}</p>
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
}
