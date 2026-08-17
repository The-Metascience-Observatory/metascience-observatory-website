#!/usr/bin/env python3
"""One-off: re-file the eye-genetics rows onto a consistent subdiscipline.

Every row that had ``subdiscipline = ophthalmology`` was a genetic-association
or GWAS study, not a clinical ophthalmology study -- the ontology offered no
genetics option under ``medical fields``, so the classifier reached for the
organ-system specialty.  The same genre was also scattered across
``epidemiology``, ``pharmacology and toxicology`` and ``biology / genetics``,
so the CTNND2 high-myopia GWAS sat under three different subdisciplines at
once.

The split applied here is on the *claim the row makes*, not the journal:

  medical fields / medical genetics   the phenotype is a diagnosed disease in a
                                      patient population, or the outcome is a
                                      genotype-driven treatment response
                                      (glaucoma, keratoconus, AMD, Fuchs'
                                      dystrophy, diabetic retinopathy,
                                      steroid-induced ocular hypertension)

  biology / genetics                  the phenotype is a quantitative trait or
                                      a biological mechanism (refractive error
                                      and myopia, corneal thickness as a
                                      measurement, the retinal aging clock)

``medical genetics`` was added to the ``medical fields`` array of
``metascience_observatory_topic_ontology.json`` in the same change.

Dry run by default -- pass --apply to write.  Rows are addressed by CSV record
number *and* by expected ``original_title``; a title mismatch aborts the whole
run rather than corrupting a neighbouring row.
"""

from __future__ import annotations

import argparse
import csv
import io
import os
import shutil
import sys
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(HERE)), "data")
BACKUP_DIR = os.path.join(DATA_DIR, "backup")
VERSION_HISTORY = os.path.join(DATA_DIR, "version_history.txt")

MEDICAL_GENETICS = ("medical fields", "medical genetics")
GENETICS = ("biology", "genetics")

# (csv record number, expected original_title, target discipline/subdiscipline)
# Record number counts the header as record 1, matching the numbers reported in
# the audit.  The title is the guard -- it is compared before anything is written.
ASSIGNMENTS = [
    # --- ocular disease susceptibility + pharmacogenetics -> medical genetics ---
    # was: ophthalmology (17)
    (3198, "NEI age-related eye disease study (AREDS) dbGAP genome-wide association study", MEDICAL_GENETICS),
    (3199, "Seven new loci associated with age-related macular degeneration", MEDICAL_GENETICS),
    (6745, "Assessment of SNPs associated with the human glucocorticoid receptor in primary open-angle glaucoma and steroid responders", MEDICAL_GENETICS),
    (6746, "Glucocorticoid receptor polymorphisms and intraocular pressure response to intravitreal triamcinolone acetonide", MEDICAL_GENETICS),
    (6747, "Genome-wide association analyses identify multiple loci associated with central corneal thickness and keratoconus", MEDICAL_GENETICS),
    (6748, "Variation in the lysyl oxidase (LOX) gene is associated with keratoconus in family-based and case-control studies", MEDICAL_GENETICS),
    (6749, "Association of polymorphisms in the hepatocyte growth factor gene promoter with keratoconus", MEDICAL_GENETICS),
    (6750, "A genome-wide association study identifies a potential novel gene locus for keratoconus, one of the commonest causes for corneal transplantation in developed countries", MEDICAL_GENETICS),
    (6751, "Common single nucleotide polymorphisms and keratoconus in the Han Chinese population", MEDICAL_GENETICS),
    (7321, "Promoter polymorphism of the erythropoietin gene in severe diabetic eye and kidney complications", MEDICAL_GENETICS),
    (7322, "Convergence of linkage, gene expression and association data demonstrates the influence of the RAR-related orphan receptor alpha (RORA) gene on neovascular AMD: a systems biology based approach", MEDICAL_GENETICS),
    (7323, "Common sequence variants in the LOXL1 gene confer susceptibility to exfoliation glaucoma", MEDICAL_GENETICS),
    (7350, "Discovery and functional annotation of SIX6 variants in primary open-angle glaucoma", MEDICAL_GENETICS),
    (7351, "Common variants at 9p21 and 8q22 are associated with increased susceptibility to optic nerve degeneration in glaucoma", MEDICAL_GENETICS),
    (8094, "E2-2 Protein and Fuchs's Corneal Dystrophy", MEDICAL_GENETICS),
    (8302, "E2-2 Protein and Fuchs's Corneal Dystrophy", MEDICAL_GENETICS),
    (8442, "Transethnic Replication of Association of CTG18.1 Repeat Expansion of<i>TCF4</i>Gene With Fuchs' Corneal Dystrophy in Chinese Implies Common Causal Variant", MEDICAL_GENETICS),
    # was: epidemiology (7)
    (5954, "Genome-wide meta-analysis for severe diabetic retinopathy", MEDICAL_GENETICS),
    (5955, "Genome-wide meta-analysis for severe diabetic retinopathy", MEDICAL_GENETICS),
    (5956, "Genome-wide association study of diabetic retinopathy in a Taiwanese population", MEDICAL_GENETICS),
    (6203, "Genome-wide association analyses identify multiple loci associated with central corneal thickness and keratoconus", MEDICAL_GENETICS),
    (6596, "Novel common variants susceptible haplotype for exfoliation glaucoma specific to Asian population", MEDICAL_GENETICS),
    (6597, "A common variants mapping to CACNA1A is associated with susceptibility to exfoliation syndrome", MEDICAL_GENETICS),
    (6598, "Genome-wide association study identifies susceptibility loci for open-angle glaucoma at TMCO1 and CDKN2B-AS1", MEDICAL_GENETICS),
    # was: pharmacology and toxicology (3).  6744/6745 are the same paper, split
    # across two subdisciplines before this change.
    (3231, "Evaluating the association between keratoconus and reported genetic loci in a Han Chinese population", MEDICAL_GENETICS),
    (3232, "Analysis of multiple genetic loci reveals MPDZ-NF1B rs1324183 as a putative genetic marker for keratoconus", MEDICAL_GENETICS),
    (6744, "Assessment of SNPs associated with the human glucocorticoid receptor in primary open-angle glaucoma and steroid responders", MEDICAL_GENETICS),
    # was: biology / genetics (4) -- the criterion is applied uniformly, so these
    # disease-susceptibility rows move out of the basic-genetics bucket too.
    (3155, "Genome-wide association analyses identify three new susceptibility loci for primary angle closure glaucoma", MEDICAL_GENETICS),
    (3421, "Association of genetic variation with keratoconus", MEDICAL_GENETICS),
    (3422, "Association of genetic variation with keratoconus", MEDICAL_GENETICS),
    (5951, "Genomewide linkage scan in a multigeneration Caucasian pedigree identifies a novel locus for keratoconus on chromosome 5q14.3-q21.1", MEDICAL_GENETICS),

    # --- refractive-error / myopia quantitative-trait genetics -> genetics ---
    # was: pharmacology and toxicology (3)
    (2835, "Association of matrix metalloproteinase gene polymorphisms with refractive error in amish and ashkenazi families", GENETICS),
    (3229, "Genome-wide association studies reveal genetic variants in CTNND2 for high myopia in Singapore Chinese", GENETICS),
    (3230, "A genome-wide association study identifies a susceptibility locus for refractive errors and myopia at 15q14", GENETICS),
    # was: epidemiology (5)
    (4031, "The TGFB1 gene codon 10 polymorphism contributes to the genetic predisposition to high myopia", GENETICS),
    (5952, "Genome-wide association studies reveal genetic variants in CTNND2 for high myopia in Singapore Chinese", GENETICS),
    (5953, "Genome-wide association studies reveal genetic variants in CTNND2 for high myopia in Singapore Chinese", GENETICS),
    (5957, "Genome-wide meta-analyses of multiancestry cohorts identify multiple new susceptibility loci for refractive error and myopia", GENETICS),
    (5958, "Genome-wide analysis points to roles for extracellular matrix remodeling, the visual cycle, and neuronal development in myopia", GENETICS),
]

# Rows already correct and deliberately left alone, recorded so the audit trail
# accounts for all 41 eye-genetics rows:
#   3295 PAX6 / high myopia          biology / genetics
#   8412 retinal aging clock         biology / genetics


def current_master() -> str:
    """Filename named by the last non-comment line of version_history.txt."""
    with open(VERSION_HISTORY, encoding="utf-8") as fh:
        lines = [ln.strip() for ln in fh if ln.strip() and not ln.lstrip().startswith("#")]
    if not lines:
        sys.exit("version_history.txt has no non-comment lines")
    return lines[-1].split("#", 1)[0].strip()


def read_csv_exact(path: str):
    raw = open(path, newline="", encoding="utf-8").read()
    rows = list(csv.reader(io.StringIO(raw)))
    # The writer must reproduce the source byte-for-byte on untouched records,
    # otherwise the diff check downstream is meaningless.
    buf = io.StringIO(newline="")
    csv.writer(buf, lineterminator="\r\n").writerows(rows)
    if buf.getvalue() != raw:
        sys.exit("csv round-trip is not byte-exact; refusing to rewrite the master")
    return rows


def write_csv_exact(path: str, rows) -> None:
    buf = io.StringIO(newline="")
    csv.writer(buf, lineterminator="\r\n").writerows(rows)
    with open(path, "w", newline="", encoding="utf-8") as fh:
        fh.write(buf.getvalue())


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true", help="write a new master (default: dry run)")
    args = ap.parse_args()

    src_name = current_master()
    src_path = os.path.join(DATA_DIR, src_name)
    if not os.path.exists(src_path):
        sys.exit(f"master named by version_history.txt does not exist: {src_path}")

    rows = read_csv_exact(src_path)
    header = rows[0]
    c_title = header.index("original_title")
    c_field = header.index("field")
    c_disc = header.index("discipline")
    c_sub = header.index("subdiscipline")

    # --- validate every assignment before touching anything ---
    problems = []
    seen = set()
    for rec, title, _target in ASSIGNMENTS:
        if rec in seen:
            problems.append(f"record {rec} listed twice")
        seen.add(rec)
        if not (2 <= rec <= len(rows)):
            problems.append(f"record {rec} out of range (file has {len(rows)} records)")
            continue
        row = rows[rec - 1]
        if row[c_title] != title:
            problems.append(
                f"record {rec}: title mismatch\n    expected: {title!r}\n    found:    {row[c_title]!r}"
            )
        if row[c_field] != "biological sciences":
            problems.append(f"record {rec}: field is {row[c_field]!r}, expected 'biological sciences'")
    if problems:
        print("ABORT -- assignment table does not match the master:\n", file=sys.stderr)
        for p in problems:
            print("  " + p, file=sys.stderr)
        sys.exit(1)

    # --- report + mutate ---
    changed = 0
    print(f"master: {src_name}  ({len(rows) - 1} data rows)\n")
    for rec, _title, (disc, sub) in ASSIGNMENTS:
        row = rows[rec - 1]
        old = (row[c_disc], row[c_sub])
        if old == (disc, sub):
            print(f"  {rec:>5}  already {disc} / {sub} -- no change")
            continue
        print(f"  {rec:>5}  {old[0]} / {old[1]}  ->  {disc} / {sub}")
        row[c_disc], row[c_sub] = disc, sub
        changed += 1

    print(f"\n{changed} rows changed, {len(ASSIGNMENTS) - changed} already correct")

    counts = {}
    for row in rows[1:]:
        counts[row[c_sub]] = counts.get(row[c_sub], 0) + 1
    print("\nresulting counts:")
    for sub in ("ophthalmology", "medical genetics", "genetics", "epidemiology", "pharmacology and toxicology"):
        print(f"  {sub:<30} {counts.get(sub, 0)}")

    if not args.apply:
        print("\nDRY RUN -- nothing written.  Re-run with --apply to write the new master.")
        return

    stamp = datetime.now().strftime("%Y_%m_%d_%H%M%S")
    out_name = f"replications_database_{stamp}.csv"
    out_path = os.path.join(DATA_DIR, out_name)
    if os.path.exists(out_path):
        sys.exit(f"refusing to overwrite existing {out_name}")
    write_csv_exact(out_path, rows)
    print(f"\nwrote {out_name}")

    # one master in data/ -- archive the superseded file, copy first, delete only
    # once the copy is confirmed
    os.makedirs(BACKUP_DIR, exist_ok=True)
    backup_path = os.path.join(BACKUP_DIR, src_name)
    if not os.path.exists(backup_path):
        shutil.copy2(src_path, backup_path)
    if os.path.getsize(backup_path) == os.path.getsize(src_path):
        os.remove(src_path)
        print(f"archived {src_name} -> data/backup/")
    else:
        print(f"WARNING: data/backup/{src_name} differs in size; left the original in data/")

    note = (
        f"{out_name} # re-filed the 41-row eye-genetics cluster onto a consistent subdiscipline; "
        "39 rows changed, row count unchanged (8450). Every row that carried subdiscipline=ophthalmology (17) was a "
        "genetic-association/GWAS study, not a clinical ophthalmology study -- the ontology had no genetics option under "
        "'medical fields', so the classifier reached for the organ-system specialty. The same genre was also scattered "
        "across epidemiology (12), pharmacology and toxicology (6) and biology/genetics (6): the CTNND2 high-myopia GWAS "
        "sat under three different subdisciplines at once, and the glucocorticoid-receptor paper was split between "
        "ophthalmology and pharmacology. Added 'medical genetics' to the medical fields array of "
        "metascience_observatory_topic_ontology.json and split the cluster on the claim each row makes, not the journal: "
        "diagnosed disease in a patient population or a genotype-driven treatment response -> medical fields/medical "
        "genetics (31 rows: glaucoma, keratoconus, AMD, Fuchs' dystrophy, diabetic retinopathy, steroid-induced ocular "
        "hypertension); quantitative trait or biological mechanism -> biology/genetics (10 rows: refractive error and "
        "myopia, corneal thickness as a measurement, the retinal aging clock -- 8 changed, 2 already correct). "
        "ophthalmology 17->0 (term KEPT in the ontology for genuinely clinical eye studies), medical genetics 0->31, "
        "genetics 337->341, epidemiology 449->437, pharmacology and toxicology 205->199. Judgment call worth revisiting: "
        "csv records 6744/6745/6746 are steroid-response pharmacogenetics (NR3C1 SNPs -> intraocular pressure) and are "
        "filed under medical genetics because the outcome is a clinical response in treated patients; they could equally "
        "sit in pharmacology and toxicology, but all three must move together. NOT done here and still open: 757 rows "
        "carry genetic-association signal (GWAS/SNP/polymorphism) while sitting outside a genetics subdiscipline -- 298 "
        "under epidemiology, 112 under pharmacology and toxicology, 98 under psychiatry. Many are legitimately medical "
        "(pharmacogenetics, psychiatric genetics), so that needs a per-row pass, not a bulk remap. Also open: "
        "codebook_rules.json validates field and discipline but has no subdiscipline rule, so nothing checks that a "
        "subdiscipline is legal for its discipline (the master currently has 0 invalid pairs). Prevention: added a "
        "variant-vs-specialty tie-break rule to the '## Discipline & Subdiscipline' section of "
        "mo_pipeline/prompts/prompt_shared_core.md. Written by data_ingestor/scripts/fix_eye_genetics_subdisciplines.py "
        "(dry-run by default; each row guarded by an expected original_title so a shifted record number aborts)."
    )
    with open(VERSION_HISTORY, "a", encoding="utf-8") as fh:
        fh.write(note + "\n")
    print("appended version_history.txt entry")


if __name__ == "__main__":
    main()
