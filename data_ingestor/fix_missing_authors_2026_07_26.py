#!/usr/bin/env python3
"""One-off repair of rows whose author columns the automated pipeline can't fill.

55 sides (39 original_authors, 16 replication_authors) were blank in
replications_database_2026_07_26_092212.csv. Running the repo's own 15-source
fetcher (data_ingestor/fetch_metadata_from_doi.py) over them recovered ZERO —
these are precisely the residue the pipeline already failed on. Each was
diagnosed by hand; 7 turned out to be recoverable, and 4 of those were blank
because the row's DOI pointed at the WRONG OBJECT (a correction notice, a
supplemental-material stub, conference front matter, a DOI whose colon had
been mangled into a slash). Those DOIs are corrected here alongside the
authors — filling in authors while leaving the URL pointing at a different
work would make the row internally inconsistent.

Provenance for every value below was verified against Crossref / the OSF API
at the time of writing; see the printed report for the before/after.

For the OSF-hosted replication reports, author lists come from the parent
project's contributors filtered to bibliographic=True. That filter matters:
Reproducibility Project and SCORE projects add coordinators (Mallory Kidwell,
Johanna Cohoon, Lily Hopun, Timothy Errington, ...) as non-bibliographic
contributors on every project, and they are not authors of the report.

NOT fixed (documented in the report, no reliable source exists):
  - 11 Soto et al. LOPPRP rows: DOIs 404 at doi.org/Crossref/OpenAlex and the
    original_title is blank, so there is nothing to search on. Recovering
    these means reading the original-study table in Soto (2019).
  - 6 PsychFileDrawer rows: the archived submissions are anonymous (username
    only); the pages name the ORIGINAL study's authors but never the
    replicator.
  - 24 rows with no original recorded at all (blank original_url AND blank
    original_title) — mostly conference abstracts of replication studies
    where the original was never captured.
  - 4540, 7438, 8121, 8155: DOIs resolve but carry no author metadata in any
    source (old Elsevier/Wiley/SAGE records).

Usage:  python3 data_ingestor/fix_missing_authors_2026_07_26.py [--dry-run]
"""

from __future__ import annotations

import argparse
import csv
import sys
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
VERSION_HISTORY = DATA_DIR / "version_history.txt"
REPORT_PATH = Path(__file__).resolve().parent / "missing_authors_fix_report.txt"

# Each fix is matched on the row's CURRENT identifying values rather than a
# line number, so a re-run against a newer CSV either applies cleanly or
# reports a miss instead of corrupting an unrelated row.
#   match: (column, value) pairs that must all be equal
#   set:   column -> new value
#   why:   provenance note for the report
FIXES = [
    {
        "id": "666 RP:P Harmon-Jones",
        "match": {"original_url": "https://doi.org/10.1111/j.1751-9004.2008.00110.x",
                  "replication_url": "https://osf.io/zpwne/"},
        "set": {"replication_authors": "Philip Gable; Nicole Mechin"},
        "why": "OSF file zpwne -> parent node su6bm 'Replication of E Harmon-Jones et al.'; "
               "bibliographic contributors (Kidwell/Cohoon/Hopun are RP:P coordinators, excluded)",
    },
    {
        "id": "670 RP:P visual statistical learning",
        "match": {"original_url": "https://doi.org/10.1037/0278-7393.34.2.399",
                  "replication_url": "https://osf.io/ktnmc/"},
        "set": {"replication_authors": "Lutz Ostkamp; Frank Jäkel"},
        "why": "OSF file ktnmc -> parent node vkybt 'Project Reports'; bibliographic contributors",
    },
    {
        "id": "7451 fast mapping (DOI colon mangled to slash)",
        "match": {"original_url": "https://doi.org/10.1017/s0305000902005469",
                  "replication_url": "https://doi.org/10.1352/0895-8017(2007)112[40/eomiof]2.0.co;2"},
        "set": {"replication_url": "https://doi.org/10.1352/0895-8017(2007)112[40:EOMIOF]2.0.CO;2",
                "replication_authors": "Krista Wilkinson",
                "replication_title": "Effect of “Missing” Information on Fast Mapping by "
                                     "Individuals With Vocabulary Limitations Associated With "
                                     "Intellectual Disability"},
        "why": "':' in the DOI had been written as '/'; repaired DOI resolves in Crossref",
    },
    {
        "id": "8039 SCORE Nyhan replication",
        "match": {"original_url": "https://doi.org/10.1017/xps.2014.22",
                  "replication_url": "https://osf.io/ht4d5"},
        "set": {"replication_authors": "Michael Andreychik; Andrew H. Tyner; Zachary Loomas; "
                                       "Olivia Miske; Bri Luis"},
        "why": "OSF file ht4d5 -> parent node uw743 'SCORE Report'; bibliographic contributors "
               "(Errington/Arendt/Kline Struhl/etc. are SCORE staff, excluded)",
    },
    {
        "id": "8088 pointed at the correction notice, not the article",
        "match": {"original_url": "https://doi.org/10.1002/npr2.70058",
                  "replication_url": "https://doi.org/10.1002/npr2.70078"},
        "set": {"original_url": "https://doi.org/10.1002/npr2.70029",
                "original_authors": "Yuka Yasuda; Satsuki Ito; Junya Matsumoto; Toshiaki Onitsuka; "
                                    "Hidenaga Yamamori; Michiko Fujimoto; Naomi Hasegawa; "
                                    "Manabu Ikeda; Ryota Hashimoto",
                "original_title": "Clinical Characteristics of Patients With Enlarged Ventricles "
                                  "and Cognitive Impairment (EVCI): Case Series"},
        "why": "npr2.70058 is the CORRECTION notice (no authors in Crossref); the corrected "
               "article is npr2.70029",
    },
    {
        "id": "8110 pointed at supplemental-material stub",
        "match": {"original_url": "https://doi.org/10.1037/cdp0000137.supp",
                  "replication_url": "https://doi.org/10.1037/cdp0000775"},
        "set": {"original_url": "https://doi.org/10.1037/cdp0000137",
                "original_authors": "Devin English; Lisa Bowleg; Ana Maria del Río-González; "
                                    "Jeanne M. Tschann; Robert P. Agans; David J. Malebranche",
                "original_title": "Measuring Black men's police-based discrimination experiences: "
                                  "Development and validation of the Police and Law Enforcement "
                                  "(PLE) Scale"},
        "why": "'.supp' DOI is the supplement stub; parent article DOI carries the byline",
    },
    {
        "id": "8116 pointed at conference front matter, not Loftus et al. 1978",
        "match": {"original_url": "https://doi.org/10.1016/0001-4575(78)90040-4",
                  "replication_url": "https://doi.org/10.1037/xlm0001529"},
        "set": {"original_url": "https://doi.org/10.1037/0278-7393.4.1.19",
                "original_authors": "Elizabeth F. Loftus; David G. Miller; Helen J. Burns",
                "original_title": "Semantic integration of verbal information into a visual memory"},
        "why": "old DOI is IAATM proceedings front matter (no authors). The replication "
               "(10.1037/xlm0001529) is titled '...replication and extension of Loftus et al. "
               "(1978)' and is a misinformation-effect study, i.e. Loftus, Miller & Burns 1978 "
               "JEP:HLM 4(1) 19-31; E. F. Loftus is herself a coauthor of the replication",
    },
]


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
    print(f"{csv_name}: {len(rows)} rows")

    log: list[str] = []
    applied = missed = 0
    for fix in FIXES:
        hits = [r for r in rows if all((r.get(c) or "").strip() == v for c, v in fix["match"].items())]
        if len(hits) != 1:
            missed += 1
            log.append(f"MISS ({len(hits)} matches): {fix['id']}")
            print(f"  MISS ({len(hits)} matches): {fix['id']}")
            continue
        row = hits[0]
        log.append(f"\n{fix['id']}\n  why: {fix['why']}")
        for col, new in fix["set"].items():
            old = (row.get(col) or "").strip()
            log.append(f"  {col}:\n      before: {old or '(empty)'}\n      after:  {new}")
            row[col] = new
        applied += 1
        print(f"  applied: {fix['id']}")

    # Recount blanks so the report states the resulting coverage honestly.
    blank_o = sum(1 for r in rows if not (r.get("original_authors") or "").strip())
    blank_r = sum(1 for r in rows if not (r.get("replication_authors") or "").strip())
    summary = (f"applied {applied} fixes, {missed} misses; "
               f"author columns still blank: original={blank_o}, replication={blank_r} "
               f"(was 39 / 16)")
    print("  " + summary)

    REPORT_PATH.write_text(
        "Missing-author manual repair report\n"
        f"generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}   input csv: {csv_name}\n"
        f"{summary}\n"
        + "\n".join(log)
        + "\n\nNOT FIXED (no reliable source): 11 Soto LOPPRP rows (DOIs 404 everywhere, blank "
          "titles); 6 PsychFileDrawer rows (anonymous submissions); 24 rows with no original "
          "recorded; lines 4540/7438/8121/8155 (DOIs resolve but carry no author metadata in "
          "any source).\n"
    )
    print(f"wrote {REPORT_PATH}")

    if args.dry_run:
        print("dry run: no CSV written")
        return 0

    new_name = f"replications_database_{datetime.now().strftime('%Y_%m_%d_%H%M%S')}.csv"
    out_path = DATA_DIR / new_name
    with out_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)
    with VERSION_HISTORY.open("a", encoding="utf-8") as f:
        f.write(f"{new_name} # manually recovered author names for {applied} rows the API chain "
                f"couldn't fill; 4 of them also had their DOI corrected (correction notice, "
                f".supp stub, conference front matter, mangled colon). See "
                f"data_ingestor/missing_authors_fix_report.txt\n")
    print(f"wrote {out_path} and appended to version_history.txt")

    # data/ must hold exactly one master; move superseded versions to backup/.
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from data_ingestor import archive_superseded_masters
    archive_superseded_masters(new_name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
