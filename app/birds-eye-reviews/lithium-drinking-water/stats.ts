import { numberValue, type County } from './types';

export function ranks(values: number[]): number[] {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const result = new Array<number>(values.length);
  for (let start = 0; start < order.length;) {
    let end = start + 1;
    while (end < order.length && order[end].v === order[start].v) end++;
    const rank = (start + 1 + end) / 2;
    for (let j = start; j < end; j++) result[order[j].i] = rank;
    start = end;
  }
  return result;
}

export function pearson(x: number[], y: number[], weights?: number[]): number | null {
  if (x.length < 3 || x.length !== y.length) return null;
  const w = weights ?? x.map(() => 1);
  if (w.length !== x.length || [...x, ...y, ...w].some(v => !Number.isFinite(v)) || w.some(v => v <= 0)) return null;
  const total = w.reduce((a, b) => a + b, 0);
  const mx = x.reduce((s, v, i) => s + v * (w[i] / total), 0);
  const my = y.reduce((s, v, i) => s + v * (w[i] / total), 0);
  let xx = 0, yy = 0, xy = 0;
  for (let i = 0; i < x.length; i++) {
    const dx = x[i] - mx, dy = y[i] - my, wi = w[i] / total;
    xx += wi * dx * dx; yy += wi * dy * dy; xy += wi * dx * dy;
  }
  return xx > 1e-24 && yy > 1e-24 ? Math.max(-1, Math.min(1, xy / Math.sqrt(xx * yy))) : null;
}

export function completePairs(rows: County[], x: string, y: string): County[] {
  return rows.filter(r => numberValue(r[x]) !== null && numberValue(r[y]) !== null && r.totalpopulation > 0);
}

export function correlations(rows: County[], x: string, y: string, weighted = false) {
  const pairs = completePairs(rows, x, y);
  const xs = pairs.map(r => r[x] as number), ys = pairs.map(r => r[y] as number);
  const w = weighted ? pairs.map(r => r.totalpopulation) : undefined;
  return { n: pairs.length, pearson: pearson(xs, ys, w), spearman: pearson(ranks(xs), ranks(ys), w) };
}

export function filterCounties(rows: County[], states: string[], countColumn: string, minCount: number) {
  return rows.filter(r => states.includes(r.state) && (minCount <= 0 || (numberValue(r[countColumn]) ?? -1) >= minCount));
}

export function toCsv(rows: County[], columns: string[]): string {
  const quote = (value: unknown) => '"' + String(value ?? '').replaceAll('"', '""') + '"';
  return [columns.map(quote).join(','), ...rows.map(r => columns.map(c => quote(r[c])).join(','))].join('\r\n');
}
