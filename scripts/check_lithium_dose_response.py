#!/usr/bin/env python3
"""
Offline oracle for the lithium-weight-gain "dose-response by effect" section
(app/birds-eye-reviews/lithium-weight-gain/dose-response/).

Independently re-implements the arm selection in dose-response/ae-points.ts:

  * therapeutic-stratum records only, minus the hand-excluded DOIs;
  * per-arm adverse-event counts from adverse_events.per_arm[].notable_aes,
    denominators from sample_sizes.per_arm[].n_randomized;
  * lithium monotherapy arms vs placebo arms; one count per (arm, effect),
    the max over matching events so "nausea" + "vomiting" never double-count;

then, per effect, fits a random-intercept binomial GLMM (one intercept per
paper; logit and probit links) of the event rate on log10(elemental mg/day)
and on serum mmol/L, plus the patient-weighted alternative (Bernoulli rows,
cluster-robust SEs, statsmodels) — an implementation independent of dose-response/glmm.ts
(dense-grid integration and scipy optimizers instead of adaptive
Gauss-Hermite and hand-rolled Newton). Also reports the pooled placebo rate
(Wilson CI) and the population-weighted spread of drinking-water lithium
intake from the county snapshot.

Writes JSON to stdout (or --out); scripts/check_lithium_dose_response_lib.cts
compares the shipped TypeScript against it.

Usage:  python3 scripts/check_lithium_dose_response.py [--out FILE]
Requires: numpy, scipy, statsmodels (for the patient-weighted fits).
"""

import argparse
import json
import math
import os
import re
import sys

import numpy as np
from scipy.optimize import minimize
from scipy.stats import norm

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRIALS = os.path.join(ROOT, "data/birds_eye_reviews/lithium_weight_gain/trial_extractions.jsonl")
WATER = os.path.join(ROOT, "data/birds_eye_reviews/lithium_drinking_water/snapshot.v1.json")

# Mirrors lithium-weight-gain/utils.ts.
EXCLUDED = {"10.1210/jcem.81.4.8636369", "10.3389/fsurg.2025.1744520",
            "10.1177/2050313x20953000", "10.9740/mhc.2022.06.214",
            "10.12740/pp/onlinefirst/152050", "10.15406/jsrt.2018.04.00104"}
SALT_FRACTION = {"carbonate": 0.1879, "citrate": 0.0992, "orotate": 0.0428,
                 "sulfate": 0.1263, "gluconate": 0.0343}

# (key, include, exclude) — first match wins, in this order.
EFFECTS = [
    ("weight_gain", r"weight gain|weight increase|increased weight|gained weight|increase in (body )?weight", r"loss"),
    ("tremor", r"tremor|shak", None),
    ("nausea", r"nause|vomit", None),
    ("diarrhea", r"diarrh|loose stool", None),
    ("thirst_urination", r"thirst|polydips|polyur|frequent urination|urinary frequency|increased urination|diuresis", None),
    ("fatigue", r"fatigue|tired|sedat|somnol|drows|letharg|asthen", None),
    ("headache", r"headache", None),
]

MIN_ARMS = 5
MIN_PAPERS = 4


def num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) else None


def effect_of(event):
    s = (event or "").lower()
    for key, inc, exc in EFFECTS:
        if re.search(inc, s) and not (exc and re.search(exc, s)):
            return key
    return None


def elemental_dose(arm, derived):
    d = num(arm.get("dose_elemental_mg_per_day_mean"))
    if d is not None:
        return d
    salt_mg = num(arm.get("dose_salt_mg_per_day_mean"))
    frac = SALT_FRACTION.get(str(arm.get("lithium_salt") or ""))
    if salt_mg is not None and frac:
        return salt_mg * frac
    return num(derived.get("mean_elemental_mg_per_day"))


def load_points():
    pts = []
    with open(TRIALS, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                r = json.loads(line)
            except json.JSONDecodeError:
                continue
            if r.get("_status") and r["_status"] != "ok":
                continue
            doi = str(r.get("paper_id") or "")
            base = doi.split("#")[0]
            if base in EXCLUDED:
                continue
            derived = r.get("derived") or {}
            if derived.get("exposure_stratum") != "therapeutic":
                continue
            arms = {a.get("arm_id"): a for a in (r.get("study_design") or {}).get("arms") or []}
            ns = {}
            for p in (r.get("sample_sizes") or {}).get("per_arm") or []:
                n = num(p.get("n_randomized"))
                if n and n > 0:
                    ns[p.get("arm_id")] = n
            for pa in (r.get("adverse_events") or {}).get("per_arm") or []:
                aid = pa.get("arm_id")
                arm = arms.get(aid) or {}
                cat = arm.get("intervention_category")
                role = "lithium" if cat == "lithium" else "placebo" if cat == "placebo" else None
                N = ns.get(aid)
                if not role or not N:
                    continue
                best = {}
                for e in pa.get("notable_aes") or []:
                    k = effect_of(e.get("event"))
                    n = num(e.get("n"))
                    if k is None or n is None or n < 0 or n > N:
                        continue
                    best[k] = max(best.get(k, -1), n)
                for k, n in best.items():
                    dose = elemental_dose(arm, derived) if role == "lithium" else None
                    serum = None
                    if role == "lithium":
                        serum = num(arm.get("serum_lithium_mmol_L_mean"))
                        if serum is None:
                            serum = num(derived.get("mean_serum_li_mmol_L"))
                    pts.append(dict(doi=doi, base=base, arm=aid, role=role, effect=k,
                                    events=int(n), n=int(N),
                                    dose=dose if dose and dose > 0 else None,
                                    serum=serum if serum and serum > 0 else None))
    return pts


def wilson(k, n, z=1.959963984540054):
    if n == 0:
        return None
    p = k / n
    den = 1 + z * z / n
    c = (p + z * z / (2 * n)) / den
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return [p, c - h, c + h]


def fit_pooled(points, xkey, transform, link="logit"):
    """Patient-weighted: arm counts expanded to Bernoulli rows, probit/logit MLE
    with cluster-robust (G/(G-1)) SEs on the paper — the reference for
    lib/probit.ts and lib/logit.ts."""
    import statsmodels.api as sm  # only this check needs statsmodels
    use = [p for p in points if p[xkey] is not None]
    papers = sorted({p["base"] for p in use})
    if len(use) < MIN_ARMS or len(papers) < MIN_PAPERS:
        return {"gated": True, "arms": len(use), "papers": len(papers)}
    pid = {b: i for i, b in enumerate(papers)}
    x, y, g = [], [], []
    for p in use:
        xv = transform(p[xkey])
        for i in range(p["n"]):
            x.append(xv)
            y.append(1 if i < p["events"] else 0)
            g.append(pid[p["base"]])
    x, y, g = np.array(x), np.array(y), np.array(g)
    model = sm.Probit if link == "probit" else sm.Logit
    res = model(y, sm.add_constant(x)).fit(disp=0, cov_type="cluster",
                                           cov_kwds={"groups": g, "use_correction": False})
    G = len(papers)
    V = np.asarray(res.cov_params()) * G / (G - 1)
    b = np.asarray(res.params)
    se1 = math.sqrt(V[1, 1])
    xs = [transform(p[xkey]) for p in use]
    return {"gated": False, "arms": len(use), "papers": G, "beta": b.tolist(), "se1": se1,
            "p1": float(2 * (1 - norm.cdf(abs(b[1] / se1)))),
            "pred": _pred(b, V, min(xs), max(xs), link)}


def _pred(b, V, lo, hi, link):
    cdf = norm.cdf if link == "probit" else (lambda e: 1 / (1 + math.exp(-e)))
    out = []
    for i in range(5):
        xv = lo + (hi - lo) * i / 4
        eta = b[0] + b[1] * xv
        sd = math.sqrt(max(0.0, V[0, 0] + 2 * xv * V[0, 1] + xv * xv * V[1, 1]))
        out.append({"x": xv, "p": cdf(eta), "lo": cdf(eta - 1.959963984540054 * sd),
                    "hi": cdf(eta + 1.959963984540054 * sd)})
    return out


# Dense integration grid for the random intercept, in standard-normal units.
Z_GRID = np.linspace(-12.0, 12.0, 6001)
LOG_PHI_Z = -0.5 * Z_GRID ** 2 - 0.5 * math.log(2 * math.pi)


def _log_cdfs(eta, link):
    """log p and log(1 - p) for an array of linear predictors."""
    if link == "logit":
        return -np.logaddexp(0.0, -eta), -np.logaddexp(0.0, eta)
    return norm.logcdf(eta), norm.logcdf(-eta)


def glmm_loglik(theta, clusters, link):
    """Marginal log-likelihood of the random-intercept binomial model,
    integrating u = tau * z over a dense grid (trapezoid in log space) —
    deliberately a different integrator from the TypeScript's adaptive
    Gauss-Hermite quadrature. Binomial coefficients omitted (constant)."""
    b0, b1, log_tau = theta
    tau = math.exp(log_tau)
    u = tau * Z_GRID
    total = 0.0
    dz = Z_GRID[1] - Z_GRID[0]
    for rows in clusters:
        acc = LOG_PHI_Z.copy()
        for x, e, n in rows:
            lp, lq = _log_cdfs(b0 + b1 * x + u, link)
            acc = acc + e * lp + (n - e) * lq
        w = np.full_like(acc, dz)
        w[0] = w[-1] = dz / 2
        m = acc.max()
        total += m + math.log(np.sum(w * np.exp(acc - m)))
    return total


def num_hessian(f, th, h=2e-4):
    k = len(th)
    H = np.zeros((k, k))
    for i in range(k):
        for j in range(i, k):
            def at(di, dj):
                t = np.array(th, dtype=float)
                t[i] += di
                t[j] += dj
                return f(t)
            v = (at(h, h) - at(h, -h) - at(-h, h) + at(-h, -h)) / (4 * h * h)
            H[i, j] = H[j, i] = v
    return H


def fit_random(points, xkey, transform, link="logit"):
    """Random-intercept binomial GLMM (one intercept per paper) by maximum
    likelihood: Nelder-Mead from several starts, polished with BFGS, fitted
    on RAW x (the TypeScript centers x and maps back — this checks that too).
    SEs from the inverse numerical Hessian."""
    use = [p for p in points if p[xkey] is not None]
    papers = sorted({p["base"] for p in use})
    if len(use) < MIN_ARMS or len(papers) < MIN_PAPERS:
        return {"gated": True, "arms": len(use), "papers": len(papers)}
    by = {}
    for p in use:
        by.setdefault(p["base"], []).append((transform(p[xkey]), p["events"], p["n"]))
    clusters = list(by.values())
    xs = [transform(p[xkey]) for p in use]
    neg = lambda t: -glmm_loglik(t, clusters, link)
    pooled = min(0.99, max(0.01, sum(p["events"] for p in use) / sum(p["n"] for p in use)))
    g0 = math.log(pooled / (1 - pooled)) if link == "logit" else norm.ppf(pooled)
    xbar = sum(xs) / len(xs)
    best = None
    for slope in (0.0, 3.0, -3.0, 6.0, -6.0):
        for log_tau in (math.log(0.3), math.log(1.0), math.log(2.0)):
            start = [g0 - slope * xbar, slope, log_tau]
            r = minimize(neg, start, method="Nelder-Mead",
                         options={"xatol": 1e-9, "fatol": 1e-12, "maxiter": 20000, "maxfev": 40000})
            r = minimize(neg, r.x, method="BFGS", options={"gtol": 1e-8})
            if best is None or r.fun < best.fun:
                best = r
    th = best.x
    H = num_hessian(lambda t: glmm_loglik(t, clusters, link), th)
    V = np.linalg.inv(-H)
    b = th[:2]
    se1 = math.sqrt(V[1, 1])
    pred = _pred(b, V, min(xs), max(xs), link)
    return {"gated": False, "arms": len(use), "papers": len(papers),
            "beta": [float(b[0]), float(b[1])], "tau": math.exp(th[2]),
            "logLik": float(-best.fun), "se1": se1,
            "p1": float(2 * (1 - norm.cdf(abs(b[1] / se1)))), "pred": pred}


def water_intake():
    """Population-weighted p5/p50/p95 of county tap-water lithium (UCMR5 modeled
    geometric mean, µg/L) at 2 L/day, in mg/day."""
    d = json.load(open(WATER, encoding="utf-8"))
    rows = [(c["ucmr5_all_li_gm"], c.get("totalpopulation") or 0) for c in d["counties"]
            if num(c.get("ucmr5_all_li_gm")) is not None and num(c.get("totalpopulation"))]
    rows.sort()
    tot = sum(w for _, w in rows)
    out = {}
    for q in (0.05, 0.5, 0.95):
        acc = 0.0
        for v, w in rows:
            acc += w
            if acc >= q * tot:
                out[f"p{int(q * 100)}"] = v * 2 / 1000
                break
    out["counties"] = len(rows)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out")
    args = ap.parse_args()
    pts = load_points()
    effects = {}
    for key, _, _ in EFFECTS:
        li = [p for p in pts if p["effect"] == key and p["role"] == "lithium"]
        pl = [p for p in pts if p["effect"] == key and p["role"] == "placebo"]
        ke, ne = sum(p["events"] for p in pl), sum(p["n"] for p in pl)
        effects[key] = {
            "lithiumArms": len(li),
            "lithiumPapers": len({p["base"] for p in li}),
            "lithiumCrude": wilson(sum(p["events"] for p in li), sum(p["n"] for p in li)),
            "placeboArms": len(pl),
            "placebo": wilson(ke, ne),
            "fits": {
                w: {
                    link: {
                        "dose": f(li, "dose", math.log10, link),
                        "serum": f(li, "serum", lambda v: v, link),
                    }
                    for link in ("logit", "probit")
                }
                for w, f in (("random", fit_random), ("pooled", fit_pooled))
            },
        }
    out = {"nPoints": len(pts), "effects": effects, "water": water_intake()}
    s = json.dumps(out, indent=1)
    if args.out:
        open(args.out, "w").write(s)
    print(s)


if __name__ == "__main__":
    sys.exit(main())
