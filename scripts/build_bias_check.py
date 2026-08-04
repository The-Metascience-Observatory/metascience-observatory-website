#!/usr/bin/env python3
"""Regenerate every figure on content/docs/checking-for-bias.md.

That page tests whether our literature-harvested rows are biased by comparing
them against replication initiatives that defined a sampling frame in advance.
It is plain markdown with hard-coded numbers, so nothing recomputes when a new
replications database version lands and nothing warns when the prose goes
stale. This script closes that gap: it recomputes every figure from the current
master CSV (the newest one listed in data/version_history.txt) and, in --check
mode, diffs what it computed against what the markdown actually claims.

RE-RUN THIS SCRIPT whenever a new replications_database_*.csv version lands.
The August 2026 removal of 153 DARPA SCORE secondary-data rows moved the
headline comparison by 7 points and emptied three discipline cells outright,
with nothing on the page to signal it.

Rates use the site-wide definition frozen in lib/replicationOutcome.ts:
success / (success + failure + reversal), inconclusive and unrecorded outcomes
excluded from the denominator. Keep the two in sync — if that file's rule
changes, this script and the page must change with it.

The representative/targeted split is a judgment call about each project's
selection strategy and is defined in REPRESENTATIVE/TARGETED below. It is
deliberately NOT read from data/previous_replication_initiatives.csv's
`selection_design` column, which disagrees for three large members (SRP,
RP:CB, LOOPR); --strict recomputes the headline using only that column's
genuine sampling frames as a sensitivity check.

Usage:
    python3 scripts/build_bias_check.py              # write the report
    python3 scripts/build_bias_check.py --check      # verify the markdown, exit 1 on drift
    python3 scripts/build_bias_check.py --strict     # sensitivity: strict frames only

Outputs:
    scripts/bias_check_report.txt   (all figures + paste-ready tables; committed)
"""

from __future__ import annotations

import argparse
import csv
import math
import re
import statistics
import sys
from pathlib import Path

# Initiatives that enumerated a defined slice of literature and replicated what
# fell inside it, regardless of how interesting the result would be.
REPRESENTATIVE = {
    "RP:P", "socsci_2026", "Soto et al LOPPRP", "XPHIR", "RP:CB", "BRI",
    "SRP", "EROE", "SSRP", "SMR", "ExECON", "L2R:Marsden2018", "RSESR",
}
# Initiatives that deliberately went after a handful of celebrated or contested
# effects. Their low rate is a property of the selection, not of the field.
TARGETED = {"ML1", "ML2", "ML3", "ML4", "ML5", "RRR", "SPRRR"}
# 3ie re-analyses the original authors' existing datasets rather than
# collecting new data: reproducibility, not replication.
EXCLUDED = {"3ie"}
# Sensitivity check only: the `selection_design` values in
# data/previous_replication_initiatives.csv that are genuine sampling frames.
STRICT_FRAMES = {"random_frame", "exhaustive_frame",
                 "quasi_random_frame_feasibility", "method_stratified"}

# Initiatives whose rows are counted under a single discipline regardless of
# the `discipline` column. BRI is one preclinical biomedicine project that
# stratified on three bench techniques (MTT, RT-PCR, elevated plus maze); only
# the plus-maze arm is labelled neuroscience, and letting that arm stand as a
# discipline of its own created a table row comparing 29 rodent anxiety
# experiments (14 distinct papers) against mostly human fMRI/EEG work.
FOLD_INTO_DISCIPLINE = {"BRI": "biology"}

# `biology` is shown as "Biomedical": with BRI folded in it spans cancer/cell/
# molecular biology, genetics and physiology on the harvested side and preclinical
# animal work on the initiative side, which "biology" undersells.
DISPLAY_LABEL = {"biology": "Biomedical"}

# Table rows are derived, not hard-coded, so a new database version can add or
# drop a discipline without anyone editing a list. A field earns a row only when
# BOTH columns exist — a one-sided row is a coverage fact, not a comparison, and
# is reported in the omitted list instead (that is what kept a BRI-only
# "neuroscience" row out once BRI was folded into biomedical).
MIN_CELL = 20     # a cell below this carries no information and is read as blank
MIN_TABLE_B = 20  # Table B needs a real harvested sample; the initiative side may be thin
MIN_TABLE_A = 10  # Table A additionally needs MORE harvested `direct` rows than this
# A representative column drawn from one project describes that project, not the
# field. No longer an exclusion (thin fields are shown deliberately) but it is
# flagged in the report and must be disclosed in the page's footnote.
MIN_INITIATIVES = 2


def resolve_master(repo_root: Path) -> Path:
    """The master CSV is whatever version_history.txt names last. Nothing globs."""
    lines = (repo_root / "data" / "version_history.txt").read_text().strip().split("\n")
    lines = [ln for ln in lines if ln.strip() and not ln.strip().startswith("#")]
    return repo_root / "data" / lines[-1].split("#")[0].strip()


def load(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def field(row: dict, name: str) -> str:
    return (row.get(name) or "").strip()


def discipline_of(row: dict) -> str:
    """The discipline a row counts under, after folding split initiatives.

    The `discipline` column splits BRI across biology and neuroscience by bench
    technique; FOLD_INTO_DISCIPLINE keeps a single project in a single row.
    """
    tag = field(row, "replication_initiative_tag")
    return FOLD_INTO_DISCIPLINE.get(tag, field(row, "discipline"))


def label_of(discipline: str) -> str:
    return DISPLAY_LABEL.get(discipline, discipline.capitalize())


def rate(rows: list[dict]) -> tuple[int, int]:
    """Return (successes, denominator) under the frozen site-wide definition."""
    success = sum(1 for r in rows if field(r, "result").lower() == "success")
    failure = sum(1 for r in rows if field(r, "result").lower() in ("failure", "reversal"))
    return success, success + failure


def pct(rows: list[dict]) -> int | None:
    s, n = rate(rows)
    return round(100 * s / n) if n else None


def cell(rows: list[dict]) -> str:
    s, n = rate(rows)
    return f"{round(100 * s / n)}% (n={n:,})" if n else "—"


def papers(rows: list[dict]) -> int:
    """Distinct original papers behind a set of rows.

    Multi-lab projects contribute one row per participating laboratory, so a
    cell's row count can far exceed the number of independent findings in it.
    """
    return len({field(r, "original_url") for r in rows})


def paper_level(rows: list[dict]) -> tuple[int | None, int]:
    """Rate with each original paper counted once (majority of its effects)."""
    by: dict[str, list[bool]] = {}
    for r in rows:
        v = field(r, "result").lower()
        if v == "success":
            by.setdefault(field(r, "original_url"), []).append(True)
        elif v in ("failure", "reversal"):
            by.setdefault(field(r, "original_url"), []).append(False)
    if not by:
        return None, 0
    ok = [sum(v) / len(v) >= 0.5 for v in by.values()]
    return round(100 * sum(ok) / len(ok)), len(ok)


def two_proportion_p(a: list[dict], b: list[dict]) -> float:
    s1, n1 = rate(a)
    s2, n2 = rate(b)
    if not n1 or not n2:
        return float("nan")
    pooled = (s1 + s2) / (n1 + n2)
    se = math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2))
    if se == 0:
        return float("nan")
    z = (s1 / n1 - s2 / n2) / se
    return 2 * (1 - 0.5 * (1 + math.erf(abs(z) / math.sqrt(2))))


def valid_r(value: str) -> float | None:
    """Effect-size conversion produces occasional out-of-bounds artifacts."""
    try:
        x = float(value.strip())
    except (TypeError, ValueError):
        return None
    return x if abs(x) <= 1.0 else None


def strict_frame_tags(repo_root: Path) -> set[str]:
    path = repo_root / "data" / "previous_replication_initiatives.csv"
    tags = set()
    with path.open(encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            if field(row, "selection_design") in STRICT_FRAMES and field(row, "tag"):
                tags.add(field(row, "tag"))
    return tags


def build(rows: list[dict]) -> dict:
    """Compute every figure the page states."""
    tagged = lambda r: field(r, "replication_initiative_tag")  # noqa: E731
    rep = [r for r in rows if tagged(r) in REPRESENTATIVE]
    tgt = [r for r in rows if tagged(r) in TARGETED]
    har = [r for r in rows if not tagged(r)]
    init = [r for r in rows if tagged(r) and tagged(r) not in EXCLUDED]

    out: dict = {
        "total_rows": len(rows),
        "crude": {
            "initiative_rows": len(init), "initiative_pct": pct(init),
            "harvested_rows": len(har), "harvested_pct": pct(har),
            "gap": pct(har) - pct(init),
        },
        "strategy": {
            "representative": rate(rep), "representative_pct": pct(rep),
            "targeted": rate(tgt), "targeted_pct": pct(tgt),
            "harvested": rate(har), "harvested_pct": pct(har),
        },
        "residual_gap": pct(har) - pct(rep),
        "p_value": two_proportion_p(rep, har),
        "design": {
            "representative_direct_share":
                round(100 * sum(1 for r in rep if field(r, "replication_type").lower() == "direct") / len(rep)),
            "harvested_direct_share":
                round(100 * sum(1 for r in har if field(r, "replication_type").lower() == "direct") / len(har)),
            "direct_pct": pct([r for r in rows if field(r, "replication_type").lower() == "direct"]),
            "close_extension_pct": pct([r for r in rows if field(r, "replication_type").lower() == "close extension"]),
        },
        # Clustering: initiative rows repeat per lab/outcome, harvested rows do
        # not, so the two columns' n's are not equally strong evidence.
        "clustering": {
            "representative": (len(rep), papers(rep), len(rep) / papers(rep)),
            "harvested": (len(har), papers(har), len(har) / papers(har)),
            "worst": max(((t, len(g), papers(g), len(g) / papers(g))
                          for t in REPRESENTATIVE
                          for g in [[r for r in rows if tagged(r) == t]] if g),
                         key=lambda x: x[3]),
        },
        "initiatives": {}, "table_a": [], "table_b": [], "attribution": {}, "omitted": {},
        "thin": [],
    }

    for tag in sorted(REPRESENTATIVE | TARGETED | EXCLUDED):
        sub = [r for r in rows if tagged(r) == tag]
        if sub:
            out["initiatives"][tag] = (pct(sub), rate(sub)[1])

    # Rank by the size of the initiative column: that is the scarce side, and it
    # puts the cells worth reading at the top of each table.
    for disc in sorted({discipline_of(r) for r in rows if discipline_of(r)},
                       key=lambda d: -rate([r for r in rep if discipline_of(r) == d])[1]):
        r_cells = [r for r in rep if discipline_of(r) == disc]
        h_all = [r for r in har if discipline_of(r) == disc]
        h_direct = [r for r in h_all if field(r, "replication_type").lower() == "direct"]
        r_n, h_n, hd_n = rate(r_cells)[1], rate(h_all)[1], rate(h_direct)[1]

        by_tag = {}
        for r in r_cells:
            by_tag.setdefault(tagged(r), []).append(r)
        parts = sorted([(t, rate(v)[1]) for t, v in by_tag.items() if rate(v)[1]],
                       key=lambda kv: -kv[1])

        # One-sided fields are a coverage fact, not a comparison.
        if not r_n or not h_n:
            if r_n >= MIN_CELL or h_n >= MIN_CELL:
                out["omitted"][disc] = (r_n, h_n,
                                        "no representative rows" if not r_n else "no harvested rows")
            continue
        if h_n < MIN_TABLE_B:
            out["omitted"][disc] = (r_n, h_n, f"harvested column below n={MIN_TABLE_B}")
            continue

        out["table_b"].append((disc, cell(r_cells), cell(h_all)))
        if hd_n > MIN_TABLE_A:
            out["table_a"].append((disc, cell(r_cells), cell(h_direct)))
        out["attribution"][disc] = (r_n, parts, papers(r_cells))
        # Disclosed in the page footnote rather than excluded.
        if r_n < MIN_CELL or len(parts) < MIN_INITIATIVES:
            out["thin"].append((disc, r_n, len(parts),
                                "below n=%d" % MIN_CELL if r_n < MIN_CELL else "single initiative"))

    return out


def render(res: dict, master: Path) -> str:
    L = [
        "Bias-check figures for content/docs/checking-for-bias.md",
        f"master: {master.name}  ({res['total_rows']:,} rows)",
        "rate = success / (success + failure + reversal); inconclusive excluded",
        "",
        "CRUDE SPLIT",
        f"  coordinated initiatives (excl 3ie): {res['crude']['initiative_rows']:,} rows, {res['crude']['initiative_pct']}%",
        f"  literature-harvested             : {res['crude']['harvested_rows']:,} rows, {res['crude']['harvested_pct']}%",
        f"  gap: {res['crude']['gap']} points",
        "",
        "SELECTION STRATEGY",
    ]
    for key, label in (("representative", "Representative / systematically-sampled"),
                       ("targeted", "Targeted mega-replications"),
                       ("harvested", "Ad-hoc / literature-harvested")):
        s, n = res["strategy"][key]
        L.append(f"  | {label} | {n:,} | {res['strategy'][key + '_pct']}% |")
    L += [
        f"  residual gap (representative vs harvested): {res['residual_gap']} points, p = {res['p_value']:.6f}",
        "",
        "DESIGN MIX",
        f"  representative initiatives: {res['design']['representative_direct_share']}% direct",
        f"  literature-harvested      : {res['design']['harvested_direct_share']}% direct",
        f"  direct {res['design']['direct_pct']}%  |  close extension {res['design']['close_extension_pct']}%",
        "",
        "PER-INITIATIVE",
    ]
    for tag, (p, n) in sorted(res["initiatives"].items(), key=lambda kv: -kv[1][1]):
        L.append(f"  {tag:22} {p}% (n={n:,})")
    rc, hc = res["clustering"]["representative"], res["clustering"]["harvested"]
    wt, wr, wp, wratio = res["clustering"]["worst"]
    L += [
        "",
        "CLUSTERING (rows are replication attempts, not independent findings)",
        f"  representative: {rc[0]:,} rows from {rc[1]:,} papers = {rc[2]:.2f} rows/paper",
        f"  harvested     : {hc[0]:,} rows from {hc[1]:,} papers = {hc[2]:.2f} rows/paper",
        f"  worst offender: {wt} {wr} rows from {wp} papers = {wratio:.2f} rows/paper",
        "",
        "TABLE A - initiatives vs. direct replications only (paste-ready)",
        "| Discipline | \"Representative-sampled\" initiatives | Literature-harvested (direct only) |",
        "|---|---|---|",
    ]
    L += [f"| {label_of(d)} | {a} | {b} |" for d, a, b in res["table_a"]]
    L += ["", "TABLE B - initiatives vs. all harvested types (paste-ready)",
          "| Discipline | \"Representative-sampled\" initiatives | Literature-harvested (all types) |",
          "|---|---|---|"]
    L += [f"| {label_of(d)} | {a} | {b} |" for d, a, b in res["table_b"]]
    L += ["", "INITIATIVE ATTRIBUTION (definitive n; papers = distinct originals)"]
    for disc, (total, parts, n_papers) in res["attribution"].items():
        L.append(f"  {label_of(disc)} ({total}; {n_papers} papers): "
                 + ", ".join(f"{t} {n}" for t, n in parts))
    L += ["", "THIN ROWS shown anyway - the page footnote MUST disclose these",
          "  discipline: representative n / #initiatives - why"]
    for disc, r_n, k, why in res["thin"]:
        L.append(f"  {label_of(disc)}: {r_n} / {k} initiative(s) - {why}")
    if not res["thin"]: L.append("  none")
    L += ["", f"OMITTED DISCIPLINES (either column >= n={MIN_CELL})",
          "  discipline: representative n / harvested n  - reason"]
    for disc, (r_n, h_n, reason) in res["omitted"].items():
        L.append(f"  {disc}: {r_n} / {h_n}  - {reason}")
    return "\n".join(L) + "\n"


def check(res: dict, md_path: Path) -> int:
    """Diff the computed figures against what the markdown actually claims."""
    md = md_path.read_text(encoding="utf-8")
    problems: list[str] = []

    def want(label: str, text: str) -> None:
        if text not in md:
            problems.append(f"{label}: page does not contain {text!r}")

    want("crude initiative rows", f"{res['crude']['initiative_rows']:,} rows")
    want("crude harvested rows", f"{res['crude']['harvested_rows']:,} rows")
    want("crude gap", f"**{res['crude']['gap']} points rosier**")
    for key in ("representative", "targeted", "harvested"):
        s, n = res["strategy"][key]
        want(f"strategy {key}", f"| {n:,} | **{res['strategy'][key + '_pct']}%** |")
    want("residual gap", f"**{res['residual_gap']} points**")
    want("representative direct share", f"**{res['design']['representative_direct_share']}% direct**")
    want("direct rate", f"direct **{res['design']['direct_pct']}%**")
    want("close extension rate", f"close extensions **{res['design']['close_extension_pct']}%**")
    for d, a, b in res["table_a"]:
        want(f"Table A {d}", f"| {label_of(d)} | {a} | {b} |")
    for d, a, b in res["table_b"]:
        want(f"Table B {d}", f"| {label_of(d)} | {a} | {b} |")

    # Any discipline row on the page that the rules would not have produced —
    # this is the check that would have caught the BRI-only "Neuroscience" row.
    allowed = {label_of(d) for d, _, _ in res["table_a"]} | {label_of(d) for d, _, _ in res["table_b"]}
    for row in re.findall(r"^\| ([A-Z][A-Za-z& ]+?) \| \d+% \(n=[\d,]+\) \| \d+% \(n=([\d,]+)\) \|$",
                          md, re.MULTILINE):
        name = row[0].strip()
        if name not in allowed:
            problems.append(f"page shows a {name!r} row; allowed labels are {sorted(allowed)}")

    # A thin or single-project column may ship, but only if the footnote says so.
    for disc, r_n, k, why in res["thin"]:
        label = label_of(disc)
        if label.lower() not in md.lower():
            problems.append(f"{label} is a thin row ({why}, n={r_n}, {k} initiative(s)) "
                            f"but is not named anywhere in the page's caveats")

    if problems:
        print(f"DRIFT: {len(problems)} figure(s) on {md_path.name} disagree with the database\n")
        for p in problems:
            print(f"  - {p}")
        print("\nRe-run without --check to regenerate the report, then update the page.")
        return 1
    print(f"OK: every checked figure on {md_path.name} matches the current database.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parent.parent)
    ap.add_argument("--check", action="store_true", help="verify the markdown; exit 1 on drift")
    ap.add_argument("--strict", action="store_true", help="sensitivity: strict sampling frames only")
    args = ap.parse_args()

    master = resolve_master(args.repo_root)
    if not master.exists():
        print(f"master CSV named by version_history.txt is missing: {master}", file=sys.stderr)
        return 2
    rows = load(master)
    res = build(rows)

    if args.strict:
        tags = strict_frame_tags(args.repo_root)
        strict = [r for r in rows if field(r, "replication_initiative_tag") in tags]
        har = [r for r in rows if not field(r, "replication_initiative_tag")]
        print(f"strict sampling frames only ({', '.join(sorted(tags))}):")
        print(f"  representative {cell(strict)}   harvested {cell(har)}")
        print(f"  gap {pct(har) - pct(strict)} points, p = {two_proportion_p(strict, har):.6f}")
        return 0

    md_path = args.repo_root / "content" / "docs" / "checking-for-bias.md"
    if args.check:
        return check(res, md_path)

    report = render(res, master)
    out = args.repo_root / "scripts" / "bias_check_report.txt"
    out.write_text(report, encoding="utf-8")
    print(report)
    print(f"wrote {out.relative_to(args.repo_root)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
