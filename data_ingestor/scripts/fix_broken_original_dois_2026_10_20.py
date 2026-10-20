#!/usr/bin/env python3
"""Repair original-study DOIs that do not exist or point at another paper (2026-10-20).

A read-only audit (mo_pipeline: benchmarking/audit_published_dois.py, results in
benchmarking/results/2026-10-16_published_doi_audit/) resolved every distinct
original_url DOI in replications_database_2026_10_01_130503.csv against Crossref
and the doi.org handle registry. 45 rows were flagged; 2 were false positives
(a SciELO paper registered under its Portuguese title; a registry title that
drops the subtitle) and are untouched. The other 43 rows are fixed here.

Every replacement DOI was resolved in Crossref and compared with the row's
title, authors, journal, volume, issue, pages and year, and where possible with
the reference list of the replication paper itself (corpus copy). Causes found
(see the audit): DOIs written from memory by the extractor (near-misses of the
real DOI, or invented), typos printed in the citing paper's own reference list
(scep05340, cdev.130, pone.036473), GROBID truncating the last DOI segment
(de.42.4 for de.42.4.d, ...00729 for ...00729.x), and a lost "%" in a URL-encoded
DOI (2f10986111211035002).

Classes:
  * wrong or broken DOI, row otherwise right (19 entries, 22 rows): url only.
  * another paper's DOI with that paper's metadata pulled in by enrichment
    (Schnall 2008, Corning & Gondoli 2012, Manwell et al. 2004): url plus the
    corrupted fields. Najar et al. 2022 (3 rows): url, title and author list
    (confirmed by the citing paper's own XML, which links 10.1007/s00406-022-01520-7).
  * Jabbi et al. 2007: DOI is right; the title was the REPLICATION's (Bouma 2012)
    and the issue was wrong.
  * MacDonald 2000, J Pers 68(1) (8 rows from Soto 2019): DOI one digit off
    (...00090 for ...00094, which is what FReD's human coders record) and the
    bibliographic block was empty; filled from Crossref. All 8 effects are the
    five dimensions of MacDonald's Expressions of Spirituality Inventory.
  * no correct DOI can be given (5 rows): original_url blanked, the convention
    for no-DOI originals. Jacobson, LaLonde & Sullivan 1993 AER predates AER
    DOIs. Three Soto 2019 rows carry invented Elsevier DOIs and no other
    original metadata (each check-digit variant resolves to an unrelated paper),
    and the Selby/Anestis/Joiner 2008 row's DOI, title and journal match none
    of the three Selby papers the citing article lists. These 4 need a human
    to identify the original; listed in the version_history note.

Not changed: record 2474 (Kshirsagar et al. 2013 PLOS One e78930). Its DOI's
authors, journal, volume and article number all match the row; only the stored
title differs.

Usage:
    python data_ingestor/scripts/fix_broken_original_dois_2026_10_20.py            # dry run
    python data_ingestor/scripts/fix_broken_original_dois_2026_10_20.py --apply
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
EXPECTED_MASTER = "replications_database_2026_10_01_130503.csv"

D = "https://doi.org/"


def doi_only(old: str, new: str, title: str, n: int = 1) -> dict:
    return dict(url=D + old, n=n, title=title, set={"url": D + new})


# Each entry: the row's current original_url, how many rows carry it, the first
# characters of the row's current original_title (guard against a shifted or
# already-edited row), and the new values (columns named without "original_").
CHANGES: list[dict] = [
    # ---- wrong or broken DOI; the rest of the row is right ------------------
    doi_only("10.1177/0022427812448399", "10.1177/0022427812444274", "The causal impact of exposure to deviant"),
    doi_only("10.1093/schbul/sbi021", "10.1093/schbul/sbj021", "Data gathering: biased in psychosis?"),
    doi_only("10.1111/1467-9280.t2-01-01", "10.1111/1467-9280.02431", "Partition priming in judgment", n=4),
    doi_only("10.1177/0956797610395708", "10.1177/0956797610395393", "Learning about what others were doing"),
    doi_only("10.1097/QAD.0b013e32833d4237", "10.1097/QAD.0b013e32833e77c9", "The Regai Dzive Shiri Project"),
    doi_only("10.1177/216770261875768", "10.1177/2167702618757658", "Lateral eye movements increase false"),
    doi_only("10.18053/jctres.05.202004.003", "10.18053/jctres.05.2020S4.003", "Loss of consciousness, but not etiology"),
    doi_only("10.1073/pnas.2300949100", "10.1073/pnas.1936249100", "Haplotype-based identification"),
    doi_only("10.1016/0028-3932(92)90144-4", "10.1016/0028-3932(92)90058-T", "Spatio-motor cueing in unilateral"),
    doi_only("10.1056/nejmc1414754", "10.1056/NEJMc1413069", "Hidden formaldehyde in e-cigarette"),
    doi_only("10.1111/j.1467-9922.2012.00729", "10.1111/j.1467-9922.2012.00729.x", "Incidental learning of collocation"),
    doi_only("10.1109/icse.2013.6606538", "10.1109/ICSE.2013.6606638", "Measuring architecture quality"),
    doi_only("10.2190/de.42.4", "10.2190/DE.42.4.d", "Unique direct and indirect effects"),
    doi_only("10.2190/de.39.3", "10.2190/DE.39.3.d", "Conscientiousness, protective behavioral"),
    doi_only("10.1038/scep05340", "10.1038/srep05340", "Novel common variants susceptible"),
    doi_only("10.1161/circulationaha.105.576533", "10.1161/CIRCULATIONAHA.105.576850", "NAD(P)H oxidase and multidrug"),
    doi_only("10.1371/journal.pone.036473", "10.1371/journal.pone.0036473", "Multi-ethnic analysis of lipid"),
    doi_only("10.1111/cdev.130", "10.1111/cdev.13068", "Associations of number line estimation"),
    doi_only("10.1177/2f10986111211035002", "10.1177/10986111211035002", "Can We Really Defund the Police?"),
    # ---- another paper's DOI, with that paper's metadata pulled in ----------
    dict(url=D + "10.14695/kjsos.2015.18.4.15", n=1, title="Cleanliness Reduces the Severity of",
         set={"url": D + "10.1111/j.1467-9280.2008.02227.x",
              "title": "With a clean conscience: Cleanliness reduces the severity of moral judgments",
              "authors": "Simone Schnall; Jennifer Benton; Sophie Harvey",
              "journal": "Psychological Science", "volume": "19", "issue": "12",
              "pages": "1219-1222", "year": "2008"}),
    dict(url=D + "10.1016/j.bodyim.2009.09.006", n=1, title="Who is most likely to fat talk?",
         set={"url": D + "10.1016/j.bodyim.2012.05.004",
              "authors": "Alexandra F. Corning; Dawn M. Gondoli"}),
    dict(url=D + "10.3758/BF03196588", n=1, title="Single letter coloring and spatial cuing",
         set={"url": D + "10.3758/BF03196595",
              "authors": "Laurie A. Manwell; Martha Anne Roberts; Derek Besner"}),
    dict(url=D + "10.1007/s00406-022-01461-w", n=3, title="Cardiometabolic risk indicators in individuals",
         set={"url": D + "10.1007/s00406-022-01520-7",
              "title": ("Time effect on cardiometabolic risk indicators in patients with bipolar "
                        "disorder: a longitudinal case-control study"),
              "authors": "Hemen Najar; Erik Joas; Erik Pålsson; Mikael Landén",
              "volume": "273", "issue": "5", "pages": "1191-1200"}),
    # ---- right DOI, wrong title (it was the replication's own title) ---------
    dict(url=D + "10.1038/sj.mp.4001975", n=1, title="Genetically based reduced MAOA and COMT",
         set={"title": ("Convergent genetic modulation of the endocrine stress response involves "
                        "polymorphic variations of 5-HTT, COMT and MAOA"),
              "issue": "5"}),
    # ---- DOI one digit off, bibliographic block empty (Soto 2019) ------------
    dict(url=D + "10.1111/1467-6494.t01-1-00090", n=8, title="",
         set={"url": D + "10.1111/1467-6494.t01-1-00094",
              "title": "Spirituality: Description, measurement, and relation to the Five Factor Model of personality",
              "authors": "Douglas A. MacDonald",
              "journal": "Journal of Personality", "volume": "68", "issue": "1",
              "pages": "153-197", "year": "2000"}),
    # ---- no correct DOI can be given: blank the dead link -------------------
    dict(url=D + "10.1257/aer.83.4.685", n=1, title="Earnings Losses of Displaced Workers", set={"url": ""}),
    dict(url=D + "10.1016/S0191-8869(97)00198-2", n=1, title="", set={"url": ""}),
    dict(url=D + "10.1016/1054-139X(94)90042-6", n=1, title="", set={"url": ""}),
    dict(url=D + "10.1016/0191-8869(89)90238-7", n=1, title="", set={"url": ""}),
    dict(url=D + "10.1016/j.beth.2007.08.009", n=1, title="Rumination and self-injurious behaviors", set={"url": ""}),
]


def latest_csv_filename() -> str:
    lines = VERSION_HISTORY.read_text().strip().split("\n")
    lines = [ln for ln in lines if ln.strip() and not ln.strip().startswith("#")]
    return lines[-1].split("#")[0].strip()


VERSION_NOTE = (
    "repaired original-study DOIs that do not exist or point at another paper, found by a read-only "
    "Crossref + doi.org audit of every original_url (mo_pipeline benchmarking/audit_published_dois.py, "
    "2026-10-16): 45 rows flagged, 2 false positives left alone (Portuguese registry title; subtitle-less "
    "registry title), 43 rows fixed. Every replacement was resolved in Crossref and compared with title/"
    "authors/journal/volume/issue/pages/year, and where possible with the citing paper's reference list. "
    "Classes: wrong or broken DOI on an otherwise correct row (19 DOIs, 22 rows; near-misses written from "
    "memory, typos printed in the citing paper, GROBID-truncated DOIs, one lost '%' in '%2F'); another "
    "paper's DOI with its metadata pulled in by enrichment (Schnall 2008 had a Korean paper's DOI and "
    "authors; Corning & Gondoli 2012 and Manwell et al. 2004 had another paper's authors; Najar et al. 2022, "
    "3 rows, title and authors corrected from the citing paper's XML); Jabbi et al. 2007 Mol Psychiatry "
    "carried the replication's title (Bouma 2012) and issue 2 for 5; MacDonald 2000 J Pers 68(1):153-197, "
    "8 Soto-2019 rows, DOI ...00090 for ...00094 (FReD's value) with an empty bibliographic block, filled. "
    "original_url BLANKED where no correct DOI can be given (5 rows): Jacobson/LaLonde/Sullivan 1993 AER "
    "(predates AER DOIs); NEEDS A HUMAN to identify the original: Soto 2019 rows for conscientiousness-"
    "physical activity, conscientiousness-violent behaviour and agreeableness-heart disease (invented "
    "Elsevier DOIs, no other original metadata), and Selby/Anestis/Joiner 2008 for fpsyg.2016.00994 "
    "(title and journal match none of the three Selby papers it cites). Not changed: Kshirsagar et al. "
    "2013 PLOS One e78930 (DOI matches authors/journal/volume/article; stored title differs). Row count "
    "unchanged. Written by data_ingestor/scripts/fix_broken_original_dois_2026_10_20.py (dry-run by "
    "default; every change guarded by current URL, row count and title prefix)."
)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true", help="write a new master (default: dry run)")
    args = ap.parse_args()

    csv_name = latest_csv_filename()
    if csv_name != EXPECTED_MASTER:
        print(f"ERROR: latest master is {csv_name}, this fix was checked against "
              f"{EXPECTED_MASTER}. Re-verify before applying.", file=sys.stderr)
        return 1
    with (DATA_DIR / csv_name).open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)
    print(f"read {csv_name}: {len(rows)} rows")

    planned: list[tuple[int, str, str, str]] = []
    for ch in CHANGES:
        hits = [i for i, r in enumerate(rows) if r["original_url"] == ch["url"]]
        if len(hits) != ch["n"]:
            print(f"ERROR: {ch['url']}: expected {ch['n']} rows, found {len(hits)}", file=sys.stderr)
            return 1
        for i in hits:
            if not rows[i]["original_title"].startswith(ch["title"]):
                print(f"ERROR: record {i + 1} title {rows[i]['original_title'][:60]!r} does not start "
                      f"with {ch['title']!r}", file=sys.stderr)
                return 1
            if ch["title"] == "" and rows[i]["original_title"] != "":
                print(f"ERROR: record {i + 1} expected an empty original_title", file=sys.stderr)
                return 1
            new_url = ch["set"].get("url")
            if new_url and new_url.lower() == (rows[i].get("replication_url") or "").lower():
                print(f"ERROR: record {i + 1}: new original_url equals replication_url", file=sys.stderr)
                return 1
            for col, new in ch["set"].items():
                full = f"original_{col}"
                if rows[i][full] != new:
                    planned.append((i, full, rows[i][full], new))

    n_rows = len({i for i, *_ in planned})
    for i, col, old, new in planned:
        print(f"  record {i + 1:>5}  {col:22} {old[:70]!r}\n  {'':12}{'':22} -> {new[:70]!r}")
    print(f"\n{len(planned)} cell changes on {n_rows} rows")

    if not args.apply:
        print("dry run: no CSV written (pass --apply)")
        return 0

    for i, col, _, new in planned:
        rows[i][col] = new
    new_name = f"replications_database_{datetime.now().strftime('%Y_%m_%d_%H%M%S')}.csv"
    with (DATA_DIR / new_name).open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    with VERSION_HISTORY.open("a", encoding="utf-8") as f:
        f.write(f"{new_name} # {VERSION_NOTE}\n")
    print(f"wrote {new_name} and appended to version_history.txt")

    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from data_ingestor import archive_superseded_masters
    archive_superseded_masters(new_name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
