#!/usr/bin/env python3
"""Ingest effect sizes for the 26 EROE rows (Holzmeister et al. 2024,
"Examining the replicability of online experiments selected by a decision
market", Nat Hum Behav, 10.1038/s41562-024-02062-9).

Source: the paper's OSF reproduction kit, "Data and Analysis" component
(osf.io/47drs, parent project osf.io/sk82q), file data/proc/data_to_use.csv.
Effect sizes are standardized Cohen's d (d_os / d_rs) with 95% CIs; per the
codebook, d_os is always positive and d_rs is negative when the replication
effect points opposite to the original.

Populates for each EROE row:
  original_n, replication_n            <- n_os, n_rs
  original_es, replication_es          <- d_os, d_rs   (original_es_type = replication_es_type = 'd')
  original_es_95_CI, replication_es_95_CI <- [d95l, d95u]
  original_p_value, replication_p_value   <- p_os, p_rs
  original_es_r, replication_es_r      <- d / sqrt(d^2 + 4)

Matching is by de-accented lowercase first-author surname + original year
(surnames are unique across the 26 studies). The script asserts that the
existing `result` column agrees with the OSF statistical-significance
indicator (ri_ssc) for every matched row.

Usage:
  python3 scripts/ingest_eroe_effect_sizes.py <input_db.csv> <osf_data_to_use.csv> <output_db.csv>
"""

import csv
import math
import sys
import unicodedata


def deaccent(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def first_author_surname(authors: str) -> str:
    first = authors.split(";")[0].strip()
    surname = first.split()[-1] if first else ""
    return deaccent(surname).lower().replace("'", "")


def osf_surname(study_label: str) -> str:
    # e.g. "Ames and Fiske (2015)" -> "ames"; "Chao (2017)" -> "chao"
    token = study_label.split("(")[0].split(" and ")[0].split(" et al.")[0].strip()
    return deaccent(token).lower().replace("'", "")


def d_to_r(d: float) -> float:
    return d / math.sqrt(d * d + 4)


def fmt(v: float, places: int) -> str:
    s = f"{v:.{places}f}".rstrip("0").rstrip(".")
    return s if s not in ("", "-0") else "0"


def main() -> None:
    db_path, osf_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]

    with open(osf_path, newline="") as f:
        osf_rows = [r for r in csv.DictReader(f) if r["in_sample"].strip()]
    assert len(osf_rows) == 26, f"expected 26 replicated studies in OSF data, got {len(osf_rows)}"
    osf_by_surname = {osf_surname(r["study"]): r for r in osf_rows}
    assert len(osf_by_surname) == 26, "OSF first-author surnames are not unique"

    with open(db_path, newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    matched = set()
    updated = 0
    for row in rows:
        if row.get("replication_initiative_tag") != "EROE":
            continue
        surname = first_author_surname(row.get("original_authors", ""))
        osf = osf_by_surname.get(surname)
        assert osf is not None, f"no OSF match for DB row: {row['original_authors']!r}"
        assert surname not in matched, f"duplicate match for surname {surname!r}"
        matched.add(surname)

        assert row["result"] == osf["ri_ssc"], (
            f"result mismatch for {osf['study']}: DB={row['result']!r} OSF={osf['ri_ssc']!r}"
        )

        d_os, d_rs = float(osf["d_os"]), float(osf["d_rs"])
        row["original_n"] = osf["n_os"]
        row["replication_n"] = osf["n_rs"]
        row["original_es"] = fmt(d_os, 4)
        row["original_es_type"] = "d"
        row["original_es_95_CI"] = f"[{fmt(float(osf['d95l_os']), 4)}, {fmt(float(osf['d95u_os']), 4)}]"
        row["original_p_value"] = fmt(float(osf["p_os"]), 6)
        row["replication_es"] = fmt(d_rs, 4)
        row["replication_es_type"] = "d"
        row["replication_es_95_CI"] = f"[{fmt(float(osf['d95l_rs']), 4)}, {fmt(float(osf['d95u_rs']), 4)}]"
        row["replication_p_value"] = fmt(float(osf["p_rs"]), 6)
        row["original_es_r"] = fmt(d_to_r(d_os), 6)
        row["replication_es_r"] = fmt(d_to_r(d_rs), 6)

        note = "effect sizes, CIs, p-values and Ns from EROE OSF reproduction kit (osf.io/sk82q)"
        existing_source = (row.get("source") or "").strip()
        if note not in existing_source:
            row["source"] = f"{existing_source}; {note}" if existing_source else note
        updated += 1

    assert updated == 26, f"expected to update 26 EROE rows, updated {updated}"
    assert matched == set(osf_by_surname), f"unmatched OSF studies: {set(osf_by_surname) - matched}"

    with open(out_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Updated {updated} EROE rows -> {out_path}")


if __name__ == "__main__":
    main()
