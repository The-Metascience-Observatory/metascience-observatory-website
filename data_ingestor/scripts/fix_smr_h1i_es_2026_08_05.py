#!/usr/bin/env python3
"""Correct the replication effect size on the SMR Klink Study 1 H1i row.

Motoki & Iseki (2022), "Evaluating replicability of ten influential research on
sensory marketing" (10.3389/fcomm.2022.1048896), tag SMR, is otherwise fully and
correctly ingested: 10 originals / 22 effect rows, and every other row's
replication_es_r reconciles with the statistic the paper reports.

The H1i row (deodorant / "more masculine") carried H1k's effect size. The row's
own explanation field already holds the right numbers -- chi-squared = 7.9721,
counts 452 front vs 371 back of N = 823, p = 0.005 -- so the correct r is

    (452 - 371) / 823 = sqrt(7.9721 / 823) = 0.0984

not 0.327, which is H1k's value (546 vs 277 -> 0.3268). Only the magnitude is
wrong; result = "reversal" is right, since the direction genuinely opposes
Klink's prediction and p = 0.005.

The 95% CI is recomputed from the corrected r by Fisher z at N = 823.

Usage:
    python data_ingestor/fix_smr_h1i_es_2026_08_05.py --dry-run
    python data_ingestor/fix_smr_h1i_es_2026_08_05.py
"""

from __future__ import annotations

import argparse
import csv
import math
import sys
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data"
VERSION_HISTORY = DATA_DIR / "version_history.txt"

# The row is matched on its current identifying values rather than a line
# number, and the values being replaced are asserted before anything is
# written, so a re-run against a newer CSV either applies cleanly or aborts.
MATCH = {
    "replication_initiative_tag": "SMR",
    "original_url": "https://doi.org/10.1023/A:1008184423824",
    "replication_url": "https://doi.org/10.3389/fcomm.2022.1048896",
}
DESCRIPTION_PREFIX = "Study 1, H1i:"

EXPECTED_OLD = {
    "replication_es": "-0.327",
    "replication_es_r": "-0.327",
    "replication_es_95_CI": "[-0.387, -0.265]",
}

CHI_SQUARED = 7.9721
N_REPLICATION = 823


def corrected_values() -> dict[str, str]:
    r = math.sqrt(CHI_SQUARED / N_REPLICATION)
    z = math.atanh(r)
    se = 1.0 / math.sqrt(N_REPLICATION - 3)
    lo, hi = math.tanh(z - 1.96 * se), math.tanh(z + 1.96 * se)
    # Effect is in the direction opposite to the hypothesis, hence the sign.
    return {
        "replication_es": f"{-r:.3f}",
        "replication_es_r": f"{-r:.3f}",
        "replication_es_95_CI": f"[{-hi:.3f}, {-lo:.3f}]",
    }


def latest_csv_filename() -> str:
    lines = VERSION_HISTORY.read_text().strip().split("\n")
    lines = [ln for ln in lines if ln.strip() and not ln.strip().startswith("#")]
    return lines[-1].split("#")[0].strip()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    csv_name = latest_csv_filename()
    csv_path = DATA_DIR / csv_name
    with csv_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)
    print(f"read {csv_name}: {len(rows)} rows")

    hits = [
        r for r in rows
        if all(r.get(k, "") == v for k, v in MATCH.items())
        and r.get("description", "").startswith(DESCRIPTION_PREFIX)
    ]
    if len(hits) != 1:
        print(f"ERROR: expected exactly 1 matching row, found {len(hits)}", file=sys.stderr)
        return 1
    row = hits[0]

    for col, expected in EXPECTED_OLD.items():
        if row.get(col, "") != expected:
            print(f"ERROR: {col} is {row.get(col, '')!r}, expected {expected!r}. "
                  "Already fixed, or the row changed -- aborting.", file=sys.stderr)
            return 1

    new_values = corrected_values()
    print(f"\n{row['description']}")
    for col, new in new_values.items():
        print(f"  {col}: {EXPECTED_OLD[col]}  ->  {new}")
    for col in ("replication_p_value", "result", "explanation"):
        print(f"  {col}: unchanged ({row[col][:60]})")

    if args.dry_run:
        print("\ndry run: no CSV written")
        return 0

    row.update(new_values)

    new_name = f"replications_database_{datetime.now().strftime('%Y_%m_%d_%H%M%S')}.csv"
    out_path = DATA_DIR / new_name
    with out_path.open("w", newline="", encoding="utf-8") as f:
        # LF, not csv's default CRLF: pandas to_csv in data_ingestor.py emits LF
        # here, so matching it keeps the change a one-line diff.
        w = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    with VERSION_HISTORY.open("a", encoding="utf-8") as f:
        f.write(f"{new_name} # corrected the replication effect size on the SMR (Motoki & Iseki "
                f"2022 sensory marketing) Klink Study 1 H1i row, which had been given H1k's "
                f"value: replication_es and replication_es_r -0.327 -> "
                f"{new_values['replication_es_r']}, 95% CI {EXPECTED_OLD['replication_es_95_CI']} "
                f"-> {new_values['replication_es_95_CI']}. The row's own explanation already "
                f"carried the correct chi-squared (7.9721) and counts (452 front vs 371 back of "
                f"N=823), giving r = 81/823 = sqrt(7.9721/823) = 0.098; -0.327 is H1k's value "
                f"(546 vs 277). result stays 'reversal' -- the direction genuinely opposes "
                f"Klink's prediction at p = 0.005; only the magnitude was wrong. All 21 other "
                f"SMR rows were reconciled against the paper's reported chi-squared / F / "
                f"eta-squared and are correct. Row count unchanged.\n")
    print(f"\nwrote {out_path} and appended to version_history.txt")

    # data/ must hold exactly one master; move superseded versions to backup/.
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from data_ingestor import archive_superseded_masters
    archive_superseded_masters(new_name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
