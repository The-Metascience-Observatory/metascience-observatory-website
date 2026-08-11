#!/usr/bin/env python3
"""Apply the 12 manually-verified DOIs from the 2026-08-10 backfill, and repair
the corrupted original-study metadata on CSV line 466.

Every DOI below was confirmed by resolving it and comparing title / journal /
year / authors against the CSV row -- not by trusting an automated match. Ten
came from data_ingestor/backfill_original_dois.py; L5887 and L466 were found by
hand (L5887 scored 0.86, just under the resolver's deliberately strict 0.90
cutoff, and L466 could not be auto-resolved because its stored title is wrong).

Run with --dry-run first; --apply writes a new timestamped master.
"""

import argparse
import csv
import os
import shutil
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from validation_rules import _norm_doi  # noqa: E402

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(REPO_ROOT, "data")
BACKUP_DIR = os.path.join(DATA_DIR, "backup")
VERSION_HISTORY = os.path.join(DATA_DIR, "version_history.txt")

# csv line number -> (doi, one-line justification)
DOI_UPDATES = {
    466:  ("10.1037/0022-3514.71.2.230",
           "Bargh, Chen & Burrows 1996 JPSP 71(2) 230-244 (psycnet 1996-06400-003)"),
    468:  ("10.1037/0022-3514.74.4.865",
           "Dijksterhuis & van Knippenberg 1998 JPSP 74(4) 865-877"),
    4003: ("10.1002/1531-8249(200005)47:5<571::aid-ana3>3.0.co;2-a",
           "Annals of Neurology 2000, Crossref sim 0.96"),
    4165: ("10.1177/107939179803300105",
           "Educ & Training in Mental Retardation 1998; Crossref sim 1.00 and S2 externalIds agree"),
    4507: ("10.1016/j.brs.2012.03.006",
           "Brain Stimulation 2012, pmid 22494832, Crossref sim 1.00"),
    5356: ("10.1186/s13550-023-00956-9",
           "EJNMMI Research 2023, DOI was already in the article URL"),
    5858: ("10.48550/arXiv.2204.09654",
           "arXiv 2204.09654, arXiv API sim 1.00"),
    5887: ("10.1158/1055-9965.epi-07-0565",
           "Cancer Epidemiol Biomarkers Prev 17:397-404 (2008), Sellers/Huang match CSV authors"),
    6983: ("10.48550/arXiv.1004.2731",
           "arXiv 1004.2731, arXiv API sim 1.00"),
    7305: ("10.1126/science.1141634",
           "Science 2007, pmid 17434869, Crossref sim 1.00"),
    7307: ("10.1016/j.neuron.2007.05.022",
           "Neuron 2007, pmid 17553421, Crossref sim 0.99"),
    7308: ("10.1001/archneurol.2007.3",
           "Archives of Neurology 2008, pmid 17998437, Crossref sim 1.00"),
}

# Line 466's original-study fields held a third, unrelated paper's metadata
# (Giancardo et al., PLOS One 8(9):e74557) while its description and replication
# side were correctly Bargh/Doyen. Restore the real original study.
ROW_466_FIXES = {
    "original_title": ("Automaticity of social behavior: Direct effects of trait "
                       "construct and stereotype activation on action"),
    "original_authors": "John A. Bargh; Mark Chen; Lara Burrows",
    "original_journal": "Journal of Personality and Social Psychology",
    "original_volume": "71",
    "original_issue": "2",
    "original_pages": "230-244",
    "original_year": "1996",
}


def master_csv_path():
    with open(VERSION_HISTORY, encoding="utf-8") as fh:
        lines = [ln.strip() for ln in fh if ln.strip() and not ln.lstrip().startswith("#")]
    fname = lines[-1].split("#", 1)[0].strip()
    path = os.path.join(DATA_DIR, fname)
    if not os.path.exists(path):
        raise SystemExit(f"master named by version_history.txt is missing: {fname}")
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write the new master CSV")
    args = ap.parse_args()

    src = master_csv_path()
    with open(src, encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        fieldnames = reader.fieldnames
        rows = list(reader)
    print(f"master: {os.path.basename(src)}  ({len(rows)} rows)\n")

    changed = 0
    for line, (doi, why) in sorted(DOI_UPDATES.items()):
        row = rows[line - 2]
        norm = _norm_doi(doi)
        new_url = f"https://doi.org/{norm}"
        old = row["original_url"]
        if _norm_doi(row.get("replication_url")) == norm:
            raise SystemExit(f"ABORT L{line}: would equal replication_url (doi_self_pair)")
        print(f"L{line}: {old[:58]}\n   -> {new_url}\n   ({why})")
        row["original_url"] = new_url
        changed += 1

    print(f"\nrepairing corrupted original-study metadata on L466:")
    row466 = rows[464]
    for k, v in ROW_466_FIXES.items():
        print(f"   {k}: {row466[k][:52]!r} -> {v[:52]!r}")
        row466[k] = v

    print(f"\n{changed} original_url values updated; 7 metadata fields repaired on L466")

    if not args.apply:
        print("\nDRY RUN - nothing written.")
        return

    stamp = time.strftime("%Y_%m_%d_%H%M%S")
    out_name = f"replications_database_{stamp}.csv"
    out_path = os.path.join(DATA_DIR, out_name)
    with open(out_path, "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)

    os.makedirs(BACKUP_DIR, exist_ok=True)
    shutil.move(src, os.path.join(BACKUP_DIR, os.path.basename(src)))
    print(f"\nwrote data/{out_name}")
    print(f"archived {os.path.basename(src)} -> data/backup/")
    print("NEXT: append the version_history.txt line.")


if __name__ == "__main__":
    main()
