#!/usr/bin/env python3
"""
Offline cross-check for lib/probit.ts against statsmodels.

Rebuilds the sample the by-h-index page uses under the *stored result* criterion
(criterion 0) and the *mean h-index* metric, then fits

    probit(success ~ log10(1 + mean_h)), cluster-robust on the original paper

with statsmodels and prints coefficients, cluster SEs, the average marginal
effect, and delta-method predicted probabilities at a few h values. Those should
match what the page renders to ~4 decimal places.

Also runs a paper-cluster bootstrap of the same curve as an independent check on
the delta-method band.

Usage:  python3 scripts/check_probit.py [--metric mean|max|first|last]
Requires: numpy, pandas, statsmodels.
"""

import argparse
import json
import os
import re
import sys

import numpy as np
import pandas as pd
import statsmodels.api as sm
from scipy.stats import norm

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")


def latest_csv_name() -> str:
    """Last non-comment line of data/version_history.txt (mirrors latestCsvFilename)."""
    with open(os.path.join(DATA, "version_history.txt"), encoding="utf-8") as fh:
        lines = [ln for ln in (l.strip() for l in fh) if ln and not ln.startswith("#")]
    return lines[-1].split("#")[0].strip()


def normalize_doi_url(raw: str):
    """Mirrors normalizeDoiUrl() in app/replications-database/by-h-index/page.tsx."""
    s = (raw or "").strip().lower()
    m = re.search(r"doi\.org/(.+)$", s)
    if not m:
        return None
    doi = m.group(1).strip("/")
    if not doi.startswith("10."):
        return None
    return f"https://doi.org/{doi}"


def stored_code(result: str) -> str:
    r = (result or "").lower()
    if "success" in r:
        return "s"
    if "failure" in r:
        return "f"
    if "reversal" in r:
        return "r"
    return "i"


def metric_value(rec, metric: str):
    a = rec["a"]
    if not a:
        return None
    if metric == "mean":
        return sum(a) / len(a)
    if metric == "max":
        return max(a)
    if metric == "first":
        return rec.get("f")
    return rec.get("l")


def build_sample(metric: str):
    with open(os.path.join(DATA, "original_paper_h_index.json"), encoding="utf-8") as fh:
        papers = json.load(fh)["papers"]

    csv_name = latest_csv_name()
    df = pd.read_csv(os.path.join(DATA, csv_name), dtype=str, keep_default_na=False)
    print(f"CSV: {csv_name}  ({len(df):,} rows)")

    xs, ys, groups = [], [], []
    # Cluster id = the paper key, exactly as the page groups rows (DOI, else the
    # raw URL, else a per-row id so an untagged row is its own cluster).
    for i, row in enumerate(df.itertuples(index=False)):
        url = str(getattr(row, "original_url", "") or "").strip()
        doi = normalize_doi_url(url)
        key = doi or (url or f"__row_{i}")
        o = stored_code(str(getattr(row, "result", "") or ""))
        if o not in ("s", "f", "r"):
            continue
        rec = papers.get(doi) if doi else None
        if rec is None:
            continue
        val = metric_value(rec, metric)
        if val is None:
            continue
        xs.append(np.log10(1.0 + val))
        ys.append(1.0 if o == "s" else 0.0)
        groups.append(key)

    return np.asarray(xs), np.asarray(ys), np.asarray(groups), csv_name


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--metric", default="mean", choices=["mean", "max", "first", "last"])
    ap.add_argument("--boot", type=int, default=1000, help="bootstrap resamples (0 to skip)")
    args = ap.parse_args()

    x, y, groups, _ = build_sample(args.metric)
    n = len(x)
    g = pd.factorize(groups)[0]
    print(f"metric={args.metric}  n={n:,} rows  G={len(set(g)):,} papers  successes={int(y.sum()):,}")
    if n < 30:
        print("too few rows")
        return 1

    X = sm.add_constant(x)
    # use_correction=False gives the raw sandwich A^-1 B A^-1; the G/(G-1) factor
    # is applied here explicitly so this matches lib/probit.ts (and Stata's
    # small-sample factor for ML with vce(cluster)) exactly. statsmodels' own
    # default additionally multiplies by (n-1)/(n-k), a ~1.0002 difference here.
    rob = sm.Probit(y, X).fit(
        disp=0, cov_type="cluster", cov_kwds={"groups": g, "use_correction": False}
    )
    G = len(set(g))
    b0, b1 = rob.params
    V = np.asarray(rob.cov_params()) * (G / (G - 1))
    z1 = b1 / np.sqrt(V[1, 1])

    print("\n--- statsmodels probit, vce(cluster paper), G/(G-1) ---")
    print(f"beta0 = {b0: .6f}   SE = {np.sqrt(V[0,0]): .6f}")
    print(f"beta1 = {b1: .6f}   SE = {np.sqrt(V[1,1]): .6f}   "
          f"z = {z1: .4f}   p = {2*(1-norm.cdf(abs(z1))):.6f}")
    print(f"vcov  = [[{V[0,0]: .8f}, {V[0,1]: .8f}], [{V[1,0]: .8f}, {V[1,1]: .8f}]]")

    eta = b0 + b1 * x
    ame = b1 * norm.pdf(eta).mean()
    print(f"AME   = {ame: .6f} per unit log10(1+h)  "
          f"({ame*np.log10(2)*100: .2f} pp per doubling of 1+h)")

    print("\n--- delta-method predictions (compare to the page's curve) ---")
    print(f"{'h':>6} {'p':>8} {'lo':>8} {'hi':>8}")
    for h in (0, 10, 20, 40, 60, 90, 120, 180):
        xv = np.log10(1.0 + h)
        e = b0 + b1 * xv
        se = np.sqrt(max(0.0, V[0, 0] + 2 * xv * V[0, 1] + xv * xv * V[1, 1]))
        print(f"{h:>6} {norm.cdf(e)*100:>7.2f}% {norm.cdf(e-1.959963984540054*se)*100:>7.2f}%"
              f" {norm.cdf(e+1.959963984540054*se)*100:>7.2f}%")

    if args.boot > 0:
        print(f"\n--- paper-cluster bootstrap of the same curve ({args.boot} resamples) ---")
        rng = np.random.default_rng(20260725)
        idx_by_g = [np.flatnonzero(g == k) for k in range(g.max() + 1)]
        hs = np.array([0, 10, 20, 40, 60, 90, 120, 180], dtype=float)
        xg = np.log10(1.0 + hs)
        draws = []
        for _ in range(args.boot):
            pick = rng.integers(0, len(idx_by_g), len(idx_by_g))
            rows = np.concatenate([idx_by_g[k] for k in pick])
            yb = y[rows]
            if yb.min() == yb.max():
                continue
            try:
                fb = sm.Probit(yb, sm.add_constant(x[rows])).fit(disp=0)
            except Exception:
                continue
            draws.append(norm.cdf(fb.params[0] + fb.params[1] * xg))
        D = np.vstack(draws)
        lo, hi = np.percentile(D, [2.5, 97.5], axis=0)
        print(f"{'h':>6} {'lo':>8} {'hi':>8}   (vs delta-method above)")
        for j, h in enumerate(hs):
            print(f"{h:>6.0f} {lo[j]*100:>7.2f}% {hi[j]*100:>7.2f}%")

    return 0


if __name__ == "__main__":
    sys.exit(main())
