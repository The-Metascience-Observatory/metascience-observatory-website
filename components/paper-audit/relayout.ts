import type { AuditTrial, MapCluster, MapDomain } from "./types";

/**
 * Re-pack the treatment map's domain circles to suit the shape of the screen.
 *
 * The bundle's layout (ber_core/trial_map.py) is packed once for a page of about
 * 4:3. Each domain is a rigid circle holding its clusters and studies, so moving a
 * domain moves everything inside it; only the arrangement of the circles changes.
 * Same greedy packing as the pipeline (each circle goes to the free spot nearest the
 * centre, largest first), with the horizontal "stretch" chosen so the result's
 * aspect ratio comes closest to the target.
 */
const DOMAIN_GAP = 62;
const MARGIN = 56;
const STRETCHES = [0.6, 0.8, 1, 1.3, 1.7, 2.2, 2.8, 3.5, 4.5, 6];

export interface MapLayout {
  width: number;
  height: number;
  domains: MapDomain[];
  clusters: MapCluster[];
  trials: AuditTrial[];
}

function pack(radii: number[], gap: number, stretch: number): [number, number][] {
  const placed: [number, number, number][] = [];
  for (const radius of radii) {
    if (!placed.length) { placed.push([0, 0, radius]); continue; }
    let best: [number, number, number] | null = null;
    for (const [px, py, pr] of placed) {
      const reach = pr + radius + gap;
      for (let step = 0; step < 48; step++) {
        const angle = step * (2 * Math.PI / 48);
        const x = px + reach * Math.cos(angle), y = py + reach * Math.sin(angle);
        if (placed.some(([qx, qy, qr]) => Math.hypot(x - qx, y - qy) < qr + radius + gap - 1e-6)) continue;
        const score = Math.hypot(x / stretch, y);
        if (!best || score < best[0] - 1e-9) best = [score, x, y];
      }
    }
    placed.push([best![1], best![2], radius]);
  }
  return placed.map(([x, y]) => [x, y]);
}

export function relayout(
  map: { width: number; height: number; domains: MapDomain[]; clusters: MapCluster[] },
  trials: AuditTrial[],
  targetAspect: number,
): MapLayout {
  const order = [...map.domains].sort((a, b) => b.r - a.r || a.id.localeCompare(b.id));
  const radii = order.map((d) => d.r);
  let best: { error: number; centres: [number, number][] } | null = null;
  for (const stretch of STRETCHES) {
    const centres = pack(radii, DOMAIN_GAP, stretch);
    const xs = centres.map(([x], i) => [x - radii[i], x + radii[i]]).flat();
    const ys = centres.map(([, y], i) => [y - radii[i], y + radii[i]]).flat();
    const aspect = (Math.max(...xs) - Math.min(...xs) + 2 * MARGIN) / (Math.max(...ys) - Math.min(...ys) + 2 * MARGIN);
    const error = Math.abs(Math.log(aspect / targetAspect));
    if (!best || error < best.error) best = { error, centres };
  }
  const centres = best!.centres;
  const ox = Math.min(...centres.map(([x], i) => x - radii[i])) - MARGIN;
  const oy = Math.min(...centres.map(([, y], i) => y - radii[i])) - MARGIN;
  const shift = new Map(order.map((d, i) => [d.id, [centres[i][0] - ox - d.x, centres[i][1] - oy - d.y] as const]));
  const move = <T extends { x?: number; y?: number }>(item: T, domain: string | undefined): T => {
    const s = domain ? shift.get(domain) : undefined;
    return s && item.x != null && item.y != null ? { ...item, x: item.x + s[0], y: item.y + s[1] } : item;
  };
  const domains = map.domains.map((d) => move(d, d.id));
  return {
    width: Math.max(...domains.map((d) => d.x + d.r)) + MARGIN,
    height: Math.max(...domains.map((d) => d.y + d.r)) + MARGIN,
    domains,
    clusters: map.clusters.map((c) => move(c, c.domain)),
    trials: trials.map((t) => move(t, t.domain)),
  };
}
