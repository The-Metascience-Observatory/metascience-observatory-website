"""Repair the '<int>.0' volume/issue formatting on the three Gino & Desai (2012)
rows added on 2026-08-12.

CAUSE: the ingest batch mixed filled and blank replication_volume /
replication_issue cells (rows 1-2 are the Shin journal article, row 3 is the
Szabo-Douat dissertation with no volume). pandas therefore typed the incoming
column as float64, and 24 / 1 were written back as '24.0' / '1.0'.
app/replications-database/page.tsx renders these cells as raw strings, so they
would display as '24.0(1.0)'.

SCOPE: only the three rows added in this batch, each guarded by its expected
replication_url and current value so a shifted row number aborts. The same
'<int>.0' pattern exists on ~3,176 original_volume and ~1,483 replication_volume
cells elsewhere in the master; that is a pre-existing, separate cleanup and is
deliberately NOT touched here.

Dry-run by default. Pass --apply to write a new timestamped master, archive the
superseded one, and append to version_history.txt.
"""
import argparse
import csv
import datetime
import pathlib
import shutil
import sys

csv.field_size_limit(10 ** 7)

HERE = pathlib.Path(__file__).resolve().parent
DATA = HERE.parents[1] / "data"
VERSION_HISTORY = DATA / "version_history.txt"

# (replication_url, column, expected current value, corrected value)
EDITS = [
    ("https://doi.org/10.14695/KJSOS.2021.24.1.73", "replication_volume", "24.0", "24"),
    ("https://doi.org/10.14695/KJSOS.2021.24.1.73", "replication_issue", "1.0", "1"),
]

GUARD_TITLE = "Autobiographical memory of childhood and prosocial behaviors"


def current_master() -> pathlib.Path:
    for line in reversed(VERSION_HISTORY.read_text(encoding="utf-8").splitlines()):
        line = line.strip()
        if line and not line.startswith("#"):
            return DATA / line.split("#")[0].strip()
    raise SystemExit("no master named in version_history.txt")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write the new master")
    args = ap.parse_args()

    master = current_master()
    print(f"master: {master.name}")
    with master.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        cols = reader.fieldnames
        rows = list(reader)
    print(f"        {len(rows)} rows, {len(cols)} columns")

    changed = 0
    for url, col, expected, corrected in EDITS:
        targets = [(i, r) for i, r in enumerate(rows) if r["replication_url"] == url]
        if not targets:
            sys.exit(f"ABORT: no row with replication_url {url}")
        for i, r in targets:
            if r["replication_title"] != GUARD_TITLE:
                sys.exit(f"ABORT: csv line {i + 2} title guard failed: "
                         f"{r['replication_title']!r}")
            if r[col] == corrected:
                print(f"  csv line {i + 2} [{col}] already {corrected!r}, skipping")
                continue
            if r[col] != expected:
                sys.exit(f"ABORT: csv line {i + 2} [{col}] is {r[col]!r}, "
                         f"expected {expected!r}")
            print(f"  csv line {i + 2} [{col}]: {r[col]!r} -> {corrected!r}")
            r[col] = corrected
            changed += 1

    if not changed:
        print("nothing to change")
        return 0
    if not args.apply:
        print(f"\nDRY RUN -- {changed} cell(s) would change. Re-run with --apply.")
        return 0

    stamp = datetime.datetime.now().strftime("%Y_%m_%d_%H%M%S")
    out = DATA / f"replications_database_{stamp}.csv"
    with out.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    print(f"\nwrote {out.name} ({len(rows)} rows)")

    note = (
        f"{out.name} # cosmetic repair of 2 cells on the Gino & Desai (2012) rows added "
        f"minutes earlier in {master.name}: replication_volume '24.0' -> '24' and "
        f"replication_issue '1.0' -> '1' on the two Shin (2021) rows. Cause: that ingest "
        f"batch mixed filled and blank replication_volume/replication_issue cells (the "
        f"Szabo-Douat dissertation row has neither), so pandas typed the incoming column "
        f"float64 and wrote the integers back with a trailing '.0'; "
        f"app/replications-database/page.tsx renders these cells as raw strings, so they "
        f"displayed as '24.0(1.0)'. Row count unchanged (8458). NOT touched, and a "
        f"separate job: the same '<int>.0' pattern sits on ~3,176 original_volume, ~1,483 "
        f"replication_volume, ~151 original_issue, ~160 replication_issue and ~98% of "
        f"both _n columns across the rest of the master -- a global normalization pass "
        f"that should be decided on its own merits, not smuggled in here. Written by "
        f"data_ingestor/scripts/fix_gino_desai_volume_floats_2026_08_12.py (dry-run by default; "
        f"each cell guarded by its expected replication_url, replication_title and "
        f"current value, so a shifted row number aborts)."
    )
    with VERSION_HISTORY.open("a", encoding="utf-8") as fh:
        fh.write(note + "\n")
    print("appended to version_history.txt")

    backup = DATA / "backup"
    backup.mkdir(exist_ok=True)
    shutil.move(str(master), str(backup / master.name))
    print(f"archived {master.name} -> data/backup/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
