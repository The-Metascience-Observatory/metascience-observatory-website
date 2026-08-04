#!/usr/bin/env python3
"""Independent oracle for the correlates-of-reproducibility page.

Recomputes, from the committed data files, everything the page shows:

  * the correlation table (Pearson on transformed x, Spearman on raw x,
    paper-cluster bootstrap 95% CIs), and
  * the two fractional logit models (Papke-Wooldridge QMLE, cluster-robust
    sandwich SEs with Stata's G/(G-1) factor, AMEs with delta-method SEs),

mirroring app/replications-database/correlates-of-reproducibility/{data,stats}.ts
and lib/{correlation,logit}.ts. Compare against `npx tsx scripts/check_logit_lib.cts`.

statsmodels is NOT installed here, so the IRLS + sandwich is hand-rolled in
numpy and additionally cross-checked against an independent scipy.optimize
maximisation of the quasi-loglikelihood (guards against the oracle and the TS
lib sharing an algebra bug).

Point estimates (correlations, betas, SEs, AMEs) must match the TS output to
>= 4 decimals. Bootstrap CIs use a different RNG, so they only agree to ~0.01.

Requires: numpy, scipy, pandas.  Run:  python3 scripts/check_logit.py
"""

from __future__ import annotations

import json
import math
import re
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import optimize, stats

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

LOG10P_FLOOR = -10.0


def latest_csv_name() -> str:
    lines = [
        ln
        for ln in (DATA / "version_history.txt").read_text().strip().splitlines()
        if ln.strip() and not ln.strip().startswith("#")
    ]
    return lines[-1].split("#")[0].strip()


def normalize_doi_url(raw: str) -> str | None:
    s = (raw or "").strip().lower()
    m = re.search(r"doi\.org/(.+)$", s)
    if not m:
        return None
    doi = m.group(1).strip("/")
    if not doi.startswith("10."):
        return None
    return f"https://doi.org/{doi}"


def norm_journal(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def index_journals(raw: dict) -> dict:
    """Merge case variants, keeping the first non-null `recent` (mirrors data.ts)."""
    out: dict = {}
    for name, entry in raw.items():
        key = norm_journal(name)
        if key not in out:
            out[key] = entry.get("recent")
        elif out[key] is None:
            out[key] = entry.get("recent")
    return out


def classify_reported(result: str) -> str:
    v = (result or "").strip().lower()
    return v if v in ("success", "failure", "reversal") else "inconclusive"


def build_rows() -> pd.DataFrame:
    csv_name = latest_csv_name()
    df = pd.read_csv(DATA / csv_name, dtype=str, keep_default_na=False)

    if_index = index_journals(json.loads((DATA / "journal_impact_factors.json").read_text())["journals"])
    rank_index = index_journals(json.loads((DATA / "journal_rank_metrics.json").read_text())["journals"])
    cit = json.loads((DATA / "original_paper_citations.json").read_text())["papers"]
    hidx = json.loads((DATA / "original_paper_h_index.json").read_text())["papers"]
    overlap = json.loads((DATA / "author_overlap.json").read_text())["pairs"]

    rows = []
    for i, r in df.iterrows():
        result = str(r["result"]).strip()
        if not result:
            continue
        outcome = classify_reported(result)
        y = 1.0 if outcome == "success" else 0.0 if outcome in ("failure", "reversal") else 0.5

        url = str(r["original_url"]).strip()
        doi = normalize_doi_url(url)
        cluster = doi or url or f"__row_{len(rows)}"

        year = None
        try:
            yv = int(float(str(r["original_year"]).strip()))
            if 1500 <= yv <= 2100:
                year = yv
        except ValueError:
            pass

        jkey = norm_journal(str(r["original_journal"]))
        if_recent = if_index.get(jkey) if jkey else None
        impact = if_recent[3] if if_recent else None
        if impact is not None and impact <= 0:
            impact = None
        rank_recent = rank_index.get(jkey) if jkey else None
        sjr_pct = rank_recent[0] if rank_recent else None

        # First two complete calendar years (by[0] + by[1]), mirroring data.ts.
        cit_rec = cit.get(doi) if doi else None
        by = cit_rec.get("by") if cit_rec else None
        citations = by[0] + by[1] if isinstance(by, list) and len(by) >= 2 else None

        h_rec = hidx.get(doi) if doi else None
        h_all = h_rec["a"] if h_rec and h_rec["a"] else None
        h_mean = sum(h_all) / len(h_all) if h_all else None
        h_max = max(h_all) if h_all else None
        h_first = h_rec["f"] if h_rec else None
        h_last = h_rec["l"] if h_rec else None

        rep_doi = normalize_doi_url(str(r["replication_url"]))
        ov_rec = overlap.get(f"{doi}|{rep_doi}") if doi and rep_doi else None
        ov = ov_rec["o"] if ov_rec else None

        p_type = str(r["original_p_value_type"]).strip()
        exact_p = None
        if p_type == "=":
            try:
                pv = float(str(r["original_p_value"]).strip())
                if 0 < pv <= 1:
                    exact_p = pv
            except ValueError:
                pass

        rows.append(
            dict(cluster=cluster, y=y, year=year, impactFactor=impact, sjrPct=sjr_pct,
                 citations=citations, hFirst=h_first, hLast=h_last, hMean=h_mean,
                 hMax=h_max, overlap=ov, exactP=exact_p)
        )
    print(f"csv: {csv_name}  usable rows: {len(rows)}")
    return pd.DataFrame(rows)


# ---------------------------------------------------------------- correlations

PREDICTORS = [
    ("exactP", lambda v: np.maximum(LOG10P_FLOOR, np.log10(v))),
    ("year", None),
    ("impactFactor", np.log10),
    ("sjrPct", None),
    ("citations", lambda v: np.log10(1 + v)),
    ("hFirst", lambda v: np.log10(1 + v)),
    ("hLast", lambda v: np.log10(1 + v)),
    ("hMean", lambda v: np.log10(1 + v)),
    ("hMax", lambda v: np.log10(1 + v)),
    ("overlap", None),
]


def cluster_bootstrap_ci(x, y, clusters, method: str, iters=1000, seed=7):
    rng = np.random.default_rng(seed)
    groups = pd.Series(range(len(x))).groupby(pd.factorize(clusters)[0]).apply(list).tolist()
    g = len(groups)
    draws = []
    for _ in range(iters):
        idx = np.concatenate([groups[k] for k in rng.integers(0, g, g)])
        if method == "pearson":
            r = stats.pearsonr(x[idx], y[idx]).statistic
        else:
            r = stats.spearmanr(x[idx], y[idx]).statistic
        if np.isfinite(r):
            draws.append(r)
    draws = np.sort(draws)
    return draws[int(0.025 * (len(draws) - 1))], draws[math.ceil(0.975 * (len(draws) - 1))]


def corr_table(df: pd.DataFrame) -> None:
    print("\n== correlation table ==")
    for key, transform in PREDICTORS:
        sub = df[df[key].notna()]
        raw = sub[key].to_numpy(dtype=float)
        xt = transform(raw) if transform else raw
        y = sub["y"].to_numpy()
        cl = sub["cluster"].to_numpy()
        pr = stats.pearsonr(xt, y).statistic
        sr = stats.spearmanr(raw, y).statistic
        plo, phi = cluster_bootstrap_ci(xt, y, cl, "pearson")
        slo, shi = cluster_bootstrap_ci(raw, y, cl, "spearman")
        n_papers = len(set(cl))
        print(
            f"{key:<13} n={len(sub):>5} papers={n_papers:>5} "
            f"pearson={pr:+.6f} [{plo:+.4f}, {phi:+.4f}] "
            f"spearman={sr:+.6f} [{slo:+.4f}, {shi:+.4f}]"
        )


# --------------------------------------------------------------------- models

MODEL_COVS = ["year", "impactFactor", "sjrPct", "citations", "hMean", "overlap"]
MODEL_TRANSFORM = {
    "impactFactor": np.log10,
    "citations": lambda v: np.log10(1 + v),
    "hMean": lambda v: np.log10(1 + v),
    "exactP": lambda v: np.maximum(LOG10P_FLOOR, np.log10(v)),
}


def fit_fractional_logit(X: np.ndarray, y: np.ndarray, clusters: np.ndarray):
    """IRLS + cluster sandwich, mirroring lib/logit.ts formula for formula."""
    n, k = X.shape
    Xd = np.column_stack([np.ones(n), X])
    p = k + 1
    ybar = min(1 - 1e-6, max(1e-6, y.mean()))
    beta = np.zeros(p)
    beta[0] = math.log(ybar / (1 - ybar))

    def mu_of(b):
        eta = Xd @ b
        return eta, np.clip(1 / (1 + np.exp(-eta)), 1e-10, 1 - 1e-10)

    def qll(mu):
        return float(np.sum(y * np.log(mu) + (1 - y) * np.log(1 - mu)))

    eta, mu = mu_of(beta)
    ll = qll(mu)
    for it in range(100):
        w = mu * (1 - mu)
        z = eta + (y - mu) / w
        A = Xd.T @ (Xd * w[:, None])
        rhs = Xd.T @ (w * z)
        cand = np.linalg.solve(A, rhs)
        for _ in range(10):
            eta, mu = mu_of(cand)
            ll_new = qll(mu)
            if ll_new >= ll - 1e-12:
                ll = ll_new
                break
            cand = (cand + beta) / 2
        step = np.max(np.abs(cand - beta))
        beta = cand
        if step < 1e-10:
            break
    iterations = it + 1

    eta, mu = mu_of(beta)
    w = mu * (1 - mu)
    A = Xd.T @ (Xd * w[:, None])
    bread = np.linalg.inv(A)

    codes = pd.factorize(clusters)[0]
    G = codes.max() + 1
    scores = (y - mu)[:, None] * Xd
    S = np.zeros((G, p))
    np.add.at(S, codes, scores)
    meat = S.T @ S
    V = (G / (G - 1)) * bread @ meat @ bread

    se = np.sqrt(np.diag(V))
    zstat = beta / se
    pval = 2 * (1 - stats.norm.cdf(np.abs(zstat)))

    mean_w = w.mean()
    ames, ame_ses = [], []
    for j in range(1, p):
        ame = beta[j] * mean_w
        dw = w * (1 - 2 * mu)
        grad = (beta[j] * dw[:, None] * Xd).mean(axis=0)
        grad[j] += mean_w
        ame_ses.append(math.sqrt(grad @ V @ grad))
        ames.append(ame)

    # Independent optimum check: BFGS on the negative quasi-loglik.
    def negll(b):
        _, m = mu_of(b)
        return -qll(m)

    res = optimize.minimize(negll, np.zeros(p), method="BFGS", options={"gtol": 1e-9, "maxiter": 500})
    gap = np.max(np.abs(res.x - beta))
    assert gap < 1e-5, f"IRLS vs BFGS optimum disagree: max|diff| = {gap:.2e}"

    return dict(beta=beta, se=se, z=zstat, p=pval, ame=ames, ame_se=ame_ses,
                iterations=iterations, n=n, G=G, bfgs_gap=gap)


def run_model(df: pd.DataFrame, with_p: bool) -> None:
    covs = MODEL_COVS + (["exactP"] if with_p else [])
    sub = df.dropna(subset=covs)
    y = sub["y"].to_numpy()
    cl = sub["cluster"].to_numpy()

    cols, scales = [], []
    for c in covs:
        v = sub[c].to_numpy(dtype=float)
        t = MODEL_TRANSFORM.get(c)
        if t:
            v = t(v)
        mean, sd = v.mean(), v.std()  # population sd, mirrors lib standardize()
        cols.append((v - mean) / sd)
        scales.append((c, mean, sd))
    X = np.column_stack(cols)

    fit = fit_fractional_logit(X, y, cl)
    label = "B (with log10 p)" if with_p else "A (no p-value)"
    print(f"\n== model {label} ==")
    print(f"n={fit['n']} clusters={fit['G']} iterations={fit['iterations']} "
          f"intercept={fit['beta'][0]:.6f} (BFGS gap {fit['bfgs_gap']:.1e})")
    for j, c in enumerate(covs, start=1):
        print(
            f"{c:<26} beta={fit['beta'][j]:+.6f} se={fit['se'][j]:.6f} "
            f"z={fit['z'][j]:+.4f} p={fit['p'][j]:.4e} "
            f"ame={fit['ame'][j-1]:+.6f} ameSe={fit['ame_se'][j-1]:.6f}"
        )
    for c, mean, sd in scales:
        print(f"scale {c:<13} mean={mean:.6f} sd={sd:.6f}")


def main() -> None:
    df = build_rows()
    corr_table(df)
    run_model(df, with_p=False)
    run_model(df, with_p=True)


if __name__ == "__main__":
    main()
