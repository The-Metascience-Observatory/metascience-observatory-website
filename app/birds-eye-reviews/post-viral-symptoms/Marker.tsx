/** SVG point markers: shape tells lines of one infection (one colour) apart. */

export const SHAPES = ["circle", "square", "triangle", "diamond", "down", "cross"] as const;
export type Shape = (typeof SHAPES)[number];

export function Marker({ shape, x, y, r, color, hollow = false }: {
  shape: Shape; x: number; y: number; r: number; color: string; hollow?: boolean;
}) {
  const common = {
    // The surface colour (not white) so the ring and hollow fill follow dark mode.
    fill: hollow ? "hsl(var(--card))" : color,
    stroke: hollow ? color : "hsl(var(--card))",
    strokeWidth: hollow ? 1.8 : 1.2,
  };
  switch (shape) {
    case "square":
      return <rect x={x - r * 0.85} y={y - r * 0.85} width={r * 1.7} height={r * 1.7} {...common} />;
    case "triangle":
      return <polygon points={`${x},${y - r * 1.1} ${x + r},${y + r * 0.75} ${x - r},${y + r * 0.75}`} {...common} />;
    case "down":
      return <polygon points={`${x},${y + r * 1.1} ${x + r},${y - r * 0.75} ${x - r},${y - r * 0.75}`} {...common} />;
    case "diamond":
      return <polygon points={`${x},${y - r * 1.15} ${x + r},${y} ${x},${y + r * 1.15} ${x - r},${y}`} {...common} />;
    case "cross": {
      const a = r * 0.45;
      return (
        <polygon
          points={`${x - a},${y - r} ${x + a},${y - r} ${x + a},${y - a} ${x + r},${y - a} ${x + r},${y + a} ${x + a},${y + a} ${x + a},${y + r} ${x - a},${y + r} ${x - a},${y + a} ${x - r},${y + a} ${x - r},${y - a} ${x - a},${y - a}`}
          {...common}
        />
      );
    }
    default:
      return <circle cx={x} cy={y} r={r} {...common} />;
  }
}
