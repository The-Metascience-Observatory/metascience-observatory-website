#!/usr/bin/env python3
"""Merge the duplicate clusters exposed by the FLoRA wrong-record DOI fix.

fix_flora_wrong_record_dois_2026_10_01.py repointed rows that had been filed
under peer-review records and a corrigendum. That made two clusters visible as
what they always were: the same replication entered more than once.

1. Eimer (1996) N2pc, #EEGManyLabs (Constant et al. 2025, Cortex 190:304-341).
   Three extractions of the one paper: from the PCI RR recommendation (3 rows:
   form / colour / form>colour), the author response (form / colour) and the
   decision letter (form / colour). Kept the three recommendation rows, which
   cover every claim; deleted the 4 others. The one detail only a deleted row
   carried (the colour N2pc "did not technically replicate, though a negative
   deflection was found 70ms earlier than originally reported") is appended to
   the surviving colour row's explanation.

2. Boekel et al. (2015), Cortex 66:115-133: five structural brain-behaviour
   replications, 17 effects. Before this fix it was entered at two
   granularities at once:
     - study level, twice: 5 sparse rows (no n/ES/explanation) and 5 rows
       formerly filed under the 2017 corrigendum (n, explanation);
     - effect level: FReD's 5 FBN rows for Kanai 2012 (1807-1811), 4 rows for
       Xu 2012 and 2 for Kanai 2011 (distractibility).
   One row per effect is the convention, so where effect-level rows exist the
   study-level summary is redundant. Deleted: the 5 sparse study-level rows,
   and the study-level Xu and Kanai-2011 rows. Kept study-level only where no
   effect-level rows exist (Forstmann 2010: a single effect anyway; Westlye
   2011). The study-level Kanai-2012 row is NOT deleted but converted into the
   one Kanai-2012 effect FReD lacks -- real-world social network size (SNS) vs
   right amygdala GM, the only one of the 17 effects whose p-value indicated a
   successful replication -- so that effect is not lost.

   Effect-level values are filled from Boekel et al.'s tables. The 2017
   corrigendum (Keuken et al., 10.1016/j.cortex.2017.03.007) found a DWI
   post-processing error and recomputed the Forstmann and Xu effects, so those
   rows carry the CORRECTED values; conclusions did not change, except that Xu
   BAS-Fun/MD moves from anecdotal to moderate evidence for H0 (BF01 2.04 ->
   3.66), so that row goes inconclusive -> failure.

Usage:
    python data_ingestor/scripts/fix_boekel_n2pc_dedup_2026_10_01.py            # dry run
    python data_ingestor/scripts/fix_boekel_n2pc_dedup_2026_10_01.py --apply
"""

from __future__ import annotations

import argparse
import csv
import sys
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data"
VERSION_HISTORY = DATA_DIR / "version_history.txt"
EXPECTED_MASTER = "replications_database_2026_10_01_124155.csv"

N2PC = "https://doi.org/10.1016/j.cortex.2025.05.014"
BOEKEL = "https://doi.org/10.1016/j.cortex.2014.11.019"
CORR = "Keuken et al. 2017 corrigendum, 10.1016/j.cortex.2017.03.007"

# Rows are identified by replication_url + the start of the description; each
# must match exactly one row.
DELETE = [
    (N2PC, "The N2pc ERP component is elicited during attentional selection of form/letter"),
    (N2PC, "The N2pc ERP component is elicited during attentional selection of colour"),
    (N2PC, "The N2pc ERP component can be elicited by shape (form) stimuli"),
    (N2PC, "The N2pc ERP component can be elicited by colour stimuli"),
    (BOEKEL, "Individual differences in tract strength from right pre-SMA"),
    (BOEKEL, "Individual differences in online social network size (Facebook friends) and real-world social network size are positively correlated with grey matter volume in brain regions"),
    (BOEKEL, "Individual differences in white matter integrity (measured by diffusion tensor imaging)"),
    (BOEKEL, "Individual differences in distractibility (measured by the Cognitive Failures"),
    (BOEKEL, "Individual differences in attentional network functioning"),
    (BOEKEL, "Individual differences in white matter diffusion measures (FA, l1, MD)"),
    (BOEKEL, "Individual differences in distractibility (Cognitive Failures Questionnaire)"),
]


def effect(n_o, n_r, r_o, r_r, p, bf01, extra=""):
    """Effect-level statistic block from a Boekel et al. table row."""
    return {
        "original_n": n_o, "replication_n": n_r,
        "original_es": r_o, "original_es_type": "r", "original_es_r": r_o,
        "replication_es": r_r, "replication_es_type": "r", "replication_es_r": r_r,
        "replication_p_value": p, "replication_p_value_type": "=",
        "replication_p_value_tails": "one",
        "_bf": bf01, "_extra": extra,
    }


UPDATE = [
    (N2PC, "The N2pc component of the ERP can be elicited by colour stimuli", {
        "_append": " Merged from a duplicate row extracted from the PCI RR recommendation: the colour "
                   "N2pc 'did not technically replicate, though a negative deflection was found 70ms "
                   "earlier than originally reported.'"}),
    # Forstmann 2010 -- corrected values (old: n=31, r=.03, BF01=3.90, p=.431).
    (BOEKEL, "Individual differences in cortico-striatal tract strength", {
        "replication_n": "32", "replication_es": "-0.08", "replication_es_r": "-0.08",
        "replication_p_value": "0.67", "replication_p_value_tails": "one",
        "explanation": "No positive correlation between pre-SMA-to-striatum tract strength and LBA "
                       "flexibility. Values are the corrected ones from the " + CORR + " (DWI "
                       "post-processing error): n=32, r=-.08, BF01=6.09 (moderate evidence for H0), "
                       "one-sided p=.67; the original 2015 report had n=31, r=.03, BF01=3.90, "
                       "p=.431. Conclusion unchanged: failed replication."}),
    # Kanai 2012: study-level row -> the SNS / right amygdala effect FReD lacks.
    (BOEKEL, "Individual differences in online social network size (Facebook friends) and real-world social network size are positively correlated with grey matter volume in multiple", {
        "description": "Real-world social network size (SNS) is positively correlated with grey matter "
                       "volume in the right amygdala",
        "result": "success",
        **effect("65", "33", "0.26", "0.30", "0.041", "0.57"),
        "explanation": "Boekel et al. 2015 Table 3: r_orig=.26 (n=65), r_rep=.30 (n=33); confirmatory "
                       "BF01=.57 (anecdotal evidence for H1), exploratory replication BF0r=.27 (moderate "
                       "evidence for the proponent's hypothesis), one-sided p=.041. The only one of the 17 "
                       "effects whose p-value the authors say indicates a successful replication, with an "
                       "effect size similar to the original. Converted from a study-level Kanai 2012 row; "
                       "the five FBN effects of the same study are FReD's rows (fred:1901-1905)."}),
    # Xu 2012 -- corrected values from the corrigendum.
    (BOEKEL, "BAS-Total scores (sensitivity to reward and nonpunishment) are positively correlated with parallel", {
        **effect("51", "34", "0.51", "-0.15", "0.80", "7.89", "moderate evidence for H0")}),
    (BOEKEL, "BAS-Fun scores (tendency to seek new rewarding experiences) are positively correlated with fractional", {
        **effect("51", "35", "0.52", "-0.15", "0.80", "7.98", "moderate evidence for H0")}),
    (BOEKEL, "BAS-Fun scores (tendency to seek new rewarding experiences) are positively correlated with parallel", {
        **effect("51", "35", "0.58", "-0.04", "0.59", "5.51", "moderate evidence for H0")}),
    (BOEKEL, "BAS-Fun scores (tendency to seek new rewarding experiences) are positively correlated with mean diffusivity", {
        "result": "failure",
        **effect("51", "34", "0.51", "0.05", "0.39", "3.66",
                 "moderate evidence for H0; was anecdotal (BF01=2.04, r=.15, p=.19) before the "
                 "correction, hence the result change from inconclusive to failure")}),
    # Kanai 2011 (distractibility) -- not affected by the DWI correction.
    (BOEKEL, "Distractibility scores (CFQ) are positively correlated", {
        **effect("144", "36", "0.38", "0.22", "0.102", "1.24",
                 "anecdotal evidence for H0; exploratory BF0r=.73, anecdotal for the proponent's "
                 "hypothesis -- same direction as the original but weaker, hence inconclusive")}),
    (BOEKEL, "Distractibility scores (CFQ) are negatively correlated", {
        **effect("144", "36", "-0.28", "-0.19", "0.129", "1.51",
                 "anecdotal evidence for H0; exploratory BF0r=.67, anecdotal for the proponent's "
                 "hypothesis -- same direction as the original but weaker, hence inconclusive")}),
]
XU_PREFIX = "BAS-"


def finish(row: dict, upd: dict) -> dict:
    """Resolve the helper keys into real column values."""
    upd = dict(upd)
    bf, extra = upd.pop("_bf", None), upd.pop("_extra", "")
    app = upd.pop("_append", None)
    if app:
        upd["explanation"] = row["explanation"] + app
    if bf and "explanation" not in upd:
        src = (f"corrected values from the {CORR}" if row["description"].startswith(XU_PREFIX)
               else "Boekel et al. 2015 Table 5")
        upd["explanation"] = (f"r_orig={upd['original_es_r']} (n={upd['original_n']}), "
                              f"r_rep={upd['replication_es_r']} (n={upd['replication_n']}); "
                              f"confirmatory BF01={bf} ({extra}); one-sided "
                              f"p={upd['replication_p_value']}. Source: {src}.")
    return upd


def find(rows, url, prefix):
    hits = [i for i, r in enumerate(rows)
            if r["replication_url"] == url and r["description"].startswith(prefix)]
    if len(hits) != 1:
        raise SystemExit(f"ERROR: expected 1 row for {prefix[:60]!r}, found {len(hits)}")
    return hits[0]


VERSION_NOTE = (
    "merged the duplicate clusters exposed by the FLoRA wrong-record DOI fix (previous master). "
    "8892 -> 8881 rows. (1) Eimer 1996 N2pc / #EEGManyLabs (Constant et al. 2025 Cortex 190:304-341): "
    "the paper had been extracted three times (PCI RR recommendation, author response, decision "
    "letter); kept the 3 recommendation rows (form / colour / form>colour), deleted 4, and appended "
    "the deleted colour row's '70ms earlier negative deflection' detail to the surviving colour row. "
    "(2) Boekel et al. 2015 Cortex 66:115-133 (5 studies, 17 effects) sat at two granularities: "
    "study level twice over (5 sparse rows + 5 rows formerly under the 2017 corrigendum) and effect "
    "level (FReD's 5 Kanai-2012 FBN rows, 4 Xu-2012 rows, 2 Kanai-2011 rows). One row per effect: "
    "deleted the 5 sparse study-level rows and the study-level Xu and Kanai-2011 rows; kept "
    "study-level Forstmann 2010 (single effect) and Westlye 2011 (no effect rows); CONVERTED the "
    "study-level Kanai-2012 row into the one effect FReD lacks, SNS vs right-amygdala GM (r .26 -> "
    ".30, n 65/33, one-sided p=.041, BF01=.57), result success -- the only one of the 17 with a "
    "significant replication p. Filled n / r / p on the 6 Xu and Kanai-2011 effect rows from the "
    "paper's tables. Forstmann and Xu rows carry the CORRECTED values from the Keuken et al. 2017 "
    "corrigendum (DWI post-processing error): Forstmann n 31->32, r .03->-.08, p .431->.67; Xu "
    "BAS-Fun/MD BF01 2.04->3.66 (moderate H0), result inconclusive -> failure. Written by "
    "data_ingestor/scripts/fix_boekel_n2pc_dedup_2026_10_01.py (dry-run by default; rows matched "
    "on replication_url + description prefix, each must match exactly once)."
)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true", help="write a new master (default: dry run)")
    args = ap.parse_args()

    lines = [ln for ln in VERSION_HISTORY.read_text().splitlines() if ln.strip() and not ln.startswith("#")]
    csv_name = lines[-1].split("#")[0].strip()
    if csv_name != EXPECTED_MASTER:
        print(f"ERROR: latest master is {csv_name}, expected {EXPECTED_MASTER}", file=sys.stderr)
        return 1
    with (DATA_DIR / csv_name).open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)
    print(f"read {csv_name}: {len(rows)} rows")

    updates = []
    for url, prefix, upd in UPDATE:
        i = find(rows, url, prefix)
        upd = finish(rows[i], upd)
        print(f"\nUPDATE record {i + 1}: {rows[i]['description'][:90]}")
        for col, new in upd.items():
            if rows[i][col] != new:
                print(f"   {col}: {rows[i][col][:60]!r} -> {new[:100]!r}")
        updates.append((i, upd))
    drop = set()
    for url, prefix in DELETE:
        i = find(rows, url, prefix)
        print(f"DELETE record {i + 1}: [{rows[i]['result']}] {rows[i]['description'][:100]}")
        drop.add(i)
    if drop & {i for i, _ in updates}:
        print("ERROR: a row is both updated and deleted", file=sys.stderr)
        return 1

    for i, upd in updates:
        rows[i].update(upd)
    kept = [r for i, r in enumerate(rows) if i not in drop]
    print(f"\n{len(rows)} -> {len(kept)} rows")
    if not args.apply:
        print("dry run: no CSV written (pass --apply)")
        return 0

    new_name = f"replications_database_{datetime.now().strftime('%Y_%m_%d_%H%M%S')}.csv"
    with (DATA_DIR / new_name).open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
        w.writeheader()
        w.writerows(kept)
    with VERSION_HISTORY.open("a", encoding="utf-8") as f:
        f.write(f"{new_name} # {VERSION_NOTE}\n")
    print(f"wrote {new_name} and appended to version_history.txt")

    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from data_ingestor import archive_superseded_masters
    archive_superseded_masters(new_name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
