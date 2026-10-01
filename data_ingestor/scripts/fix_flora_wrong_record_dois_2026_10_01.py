#!/usr/bin/env python3
"""Repoint DOIs that resolve to the wrong record (FLoRA report, 2026-09).

Lukas Röseler's FLoRA team sent a sheet of 36 Observatory DOIs that resolve to
a different record than the paper the row names ("Metascience Observatory --
DOIs pointing to the wrong record (FLoRA, 2026-09).xlsx"): another paper in
the same journal, an erratum/corrigendum/addendum, a retraction-and-
replacement notice, a Faculty Opinions recommendation, an eLife author
response, a PCI RR peer-review record, a journal-issue DOI, or a book review
standing in for the book. Every entry was checked by resolving both the given
and the corrected DOI in Crossref and comparing title, authors, journal,
volume, issue, pages and year to the row (and, for the corrigendum and PCI RR
rows, by reading the text in the corpus).

35 of 36 are confirmed and fixed here. The exception is Gerber & Green (2005),
"Correction to Gerber and Green (2000), Replication of Disputed Findings, and
Reply to Imai (2005)", APSR 99(2):301-313: despite its title it is a 13-page
article that contains the replication, so its DOI is the right record and it
is left alone.

Where the wrong DOI had pulled in the wrong paper's metadata during
enrichment, the rest of the bibliographic block is repaired as well (authors
most often: all 16 "DOI for another paper" entries carried the other
paper's author list). Fields are touched only where they were wrong; casing and
formatting conventions of correct fields are left as they are.

Three groups go beyond the sheet, same defect class, found while checking it:
  * Eimer (1996) N2pc / #EEGManyLabs: FLoRA flagged the 2 rows on the PCI RR
    author response (.ar1); 5 more rows point at the PCI recommendation and
    decision letter for the same Stage 2 report. All 7 now point at the
    published article, Cortex 190:304-341 (10.1016/j.cortex.2025.05.014).
    The 5 recommendation/decision rows also carried the recommender (Maxine
    Sherman) as replication author.
  * Hofstede, Culture's Consequences: two more rows use a book-review DOI for
    the book (Gladwin 1981 AMR review of the 1980 edition; Bhagat 2002 AMR
    review of the 2001 edition). The book has no DOI, so original_url is
    blanked (the convention for no-DOI originals).

Row count is unchanged. Repointing creates duplicate clusters that this script
deliberately does NOT resolve (see the version_history note).

Usage:
    python data_ingestor/scripts/fix_flora_wrong_record_dois_2026_10_01.py            # dry run
    python data_ingestor/scripts/fix_flora_wrong_record_dois_2026_10_01.py --apply
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
EXPECTED_MASTER = "replications_database_2026_10_01_120611.csv"

D = "https://doi.org/"

# Each entry: side ("original"/"replication"), the row's current URL, how many
# rows carry it, the first characters of the row's current title (a guard
# against a shifted or already-edited row), and the new values. Columns are
# named without the side prefix.
CHANGES: list[dict] = [
    # ---- DOI for another paper -------------------------------------------
    dict(side="original", url=D + "10.1016/j.appet.2010.02.003", n=1,
         title="All I saw was the cake",
         set={"url": D + "10.1016/j.appet.2009.11.003",
              "authors": "Richard M. Piech; Michael T. Pastorino; David H. Zald"}),
    dict(side="original", url=D + "10.1177/019027250807100104", n=1,
         title="Altruism and indirect reciprocity",
         set={"url": D + "10.1177/019027250807100106",
              "authors": "Brent Simpson; Robb Willer"}),
    dict(side="original", url=D + "10.1016/j.brs.2021.01.006", n=2,
         title="Asymmetric transcallosal conduction delay",
         set={"url": D + "10.1016/j.brs.2021.02.002",
              "title": "Asymmetric transcallosal conduction delay leads to finer bimanual coordination",
              "authors": "Marta Bortoletto; Laura Bonzano; Agnese Zazio; Clarissa Ferrari; "
                         "Ludovico Pedullà; Roberto Gasparotti; Carlo Miniussi; Marco Bove",
              "pages": "379-388"}),
    dict(side="original", url=D + "10.1002/lary.20566", n=1,
         title="Brain-derived nerve growth factor",
         set={"url": D + "10.1002/lary.20515",
              "authors": "Eric Meen; Brian Blakley; Taeed Quddusi",
              "issue": "8"}),
    dict(side="original", url=D + "10.1523/JNEUROSCI.0210-11.2011", n=2,
         title="Distractibility in daily life",
         set={"url": D + "10.1523/JNEUROSCI.5864-10.2011",
              "title": "Distractibility in daily life is reflected in the structure and function of human parietal cortex",
              "authors": "Ryota Kanai; Mia Yuan Dong; Bahador Bahrami; Geraint Rees"}),
    dict(side="original", url=D + "10.1016/j.beth.2010.12.001", n=1,
         title="Emotion as motion",
         set={"url": D + "10.1016/j.beth.2011.02.006",
              "title": "Motion as motivation: using repetitive flexion movements to stimulate the approach system",
              "authors": "Gerald J. Haeffel",
              "issue": "4"}),
    dict(side="original", url=D + "10.1016/j.homp.2005.11.002", n=1,
         title="Improvement of flow cytometric analysis",
         set={"url": D + "10.1016/j.homp.2005.10.002",
              "authors": "J. Sainte-Laudy; P. Belon"}),
    dict(side="original", url=D + "10.1111/j.1467-7687.2011.01095.x", n=6,
         title="Infants generate goal-based action predictions",
         set={"url": D + "10.1111/j.1467-7687.2011.01127.x",
              "authors": "Erin N. Cannon; Amanda L. Woodward",
              "issue": "2"}),
    dict(side="original", url=D + "10.1681/ASN.2012070675", n=1,
         title="Infection risk with bolus versus maintenance iron",
         set={"url": D + "10.1681/ASN.2012121164",
              "authors": "M. Alan Brookhart; Janet K. Freburger; Alan R. Ellis; Lily Wang; "
                         "Wolfgang C. Winkelmayer; Abhijit V. Kshirsagar"}),
    dict(side="original", url=D + "10.1093/scan/nsw017", n=2,
         title="Neuromodulation of group prejudice",
         set={"url": D + "10.1093/scan/nsv107",
              "authors": "Colin Holbrook; Keise Izuma; Choi Deblieck; Daniel M. T. Fessler; Marco Iacoboni",
              "issue": "3",
              "pages": "387-394"}),
    dict(side="original", url=D + "10.1016/0028-3932(94)90145-7", n=1,
         title="One hand is better than two",
         set={"url": D + "10.1016/0028-3932(94)90064-7",
              "authors": "Ian H. Robertson; Nigel T. North",
              "issue": "1"}),
    dict(side="original", url=D + "10.1016/s0272-7757(99)00057-6", n=1,
         title='Overeducation" in the Labor Market',
         set={"url": D + "10.1086/298261",
              "title": '"Overeducation" in the Labor Market',
              "authors": "Nachum Sicherman"}),
    dict(side="original", url=D + "10.1080/1068316x.2013.793337", n=1,
         title="Plea bargaining and appraisals",
         set={"url": D + "10.1080/1068316x.2013.770855",
              "authors": "Kathy Pezdek; Matthew O'Brien"}),
    dict(side="original", url=D + "10.1037/h0073034", n=1,
         title="The dynamogenic factors",
         set={"url": D + "10.2307/1412188",
              "authors": "Norman Triplett",
              "issue": "4"}),
    dict(side="original", url=D + "10.1017/s0140525x00001850", n=1,
         title="Unconscious cerebral initiative",
         set={"url": D + "10.1017/s0140525x00044903",
              "authors": "Benjamin Libet",
              "issue": "4",
              "pages": "529-539"}),
    dict(side="original", url=D + "10.1002/hbm.21442", n=4,
         title="White matter integrity and behavioral activation",
         set={"url": D + "10.1002/hbm.21275",
              "authors": "Jiansong Xu; Hedy Kober; Kathleen M. Carroll; Bruce J. Rounsaville; "
                         "Godfrey D. Pearlson; Marc N. Potenza"}),
    # ---- Faculty Opinions recommendation instead of the article ----------
    dict(side="original", url=D + "10.3410/f.2137000.1737107", n=1,
         title="Common variants at 7p21",
         set={"url": D + "10.1038/ng.536", "issue": "3"}),
    dict(side="original", url=D + "10.3410/f.1090454.543956", n=1,
         title="Large-scale genetic fine mapping",
         set={"url": D + "10.1038/ng2102", "issue": "9"}),
    dict(side="original", url=D + "10.3410/f.1163537.625280", n=1,
         title="REL, encoding a member",
         set={"url": D + "10.1038/ng.395", "issue": "7"}),
    dict(side="original", url=D + "10.3410/f.717957357.793461843", n=1,
         title="Single nucleotide polymorphisms and outcome risk",
         set={"url": D + "10.1182/blood-2012-01-406785"}),
    # ---- peer-review records instead of the article ----------------------
    # Eimer (1996) #EEGManyLabs Stage 2: PCI RR recommendation, author
    # response and decision letter -> the published Cortex article.
    *[dict(side="replication", url=D + u, n=n, title=t,
           set={"url": D + "10.1016/j.cortex.2025.05.014",
                "title": "A multilab investigation into the N2pc as an indicator of attentional "
                         "selectivity: Direct replication of Eimer (1996)",
                "authors": "Martin Constant; Ananya Mandal; Dariusz Asanowicz; Bartłomiej Panek; "
                           "Ilona Kotlewska; Motonori Yamaguchi; Helge Gillmeister; Dirk Kerzel; "
                           "David Luque; Sara Molinero; Antonio Vázquez-Millán; Francesca Pesciarelli; "
                           "Eleonora Borelli; Hanane Ramzaoui; Melissa Beck; Bertille Somon; "
                           "Andrea Desantis; M. Concepción Castellanos; Elisa Martín-Arévalo; "
                           "Greta Manini; Mariagrazia Capizzi; Ahu Gokce; Demet Özer; Efe Soyman; "
                           "Ece Yılmaz; Joshua O. Eayrs; Raquel E. London; Tabitha Steendam; "
                           "Christian Frings; Bernhard Pastötter; Bence Szaszkó; Pamela Baess; "
                           "Shabnamalsadat Ayatollahi; Gustavo A. León Montoya; Nicole Wetzel; "
                           "Andreas Widmann; Liyu Cao; Xueqi Low; Thiago L. Costa; Leonardo Chelazzi; "
                           "Bianca Monachesi; Siri-Maria Kamp; Luisa Knopf; Roxane J. Itier; "
                           "Johannes Meixner; Kerstin Jost; André Botes; Carley Braddock; Danqi Li; "
                           "Alicja Nowacka; Marlo Quenault; Daniele Scanzi; Tamar Torrance; "
                           "Paul M. Corballis; Gianvito Laera; Matthias Kliegel; Dominik Welke; "
                           "Faisal Mushtaq; Yuri G. Pavlov; Heinrich R. Liesefeld",
                "journal": "Cortex", "volume": "190", "issue": "", "pages": "304-341",
                "year": "2025"})
      for u, n, t in [("10.24072/pci.rr.100998", 3, "Recommendation of: A multilab"),
                      ("10.24072/pci.rr.100998.ar1", 2, "Author response of: A multilab"),
                      ("10.24072/pci.rr.100998.d1", 2, "Decision Revise: A multilab")]],
    dict(side="original", url=D + "10.7554/elife.63751.sa2", n=1,
         title="Learning precise spatiotemporal sequences",
         set={"url": D + "10.7554/elife.63751"}),
    # ---- book review instead of the book (no DOI exists for the book) ----
    dict(side="original", url=D + "10.1016/0142-694X(82)90089-8", n=2,
         title="Culture's consequences: International differences",
         set={"url": "", "authors": "Geert Hofstede"}),
    dict(side="original", url=D + "10.2307/257651", n=1,                    # beyond the sheet
         title="Culture's Consequences: International Differences",
         set={"url": "", "authors": "Geert Hofstede", "journal": "Sage",
              "volume": "", "issue": "", "pages": "", "year": "1980"}),
    dict(side="original", url=D + "10.5465/AMR.2002.7389951", n=1,         # beyond the sheet
         title="Culture's consequences: Comparing values",
         set={"url": ""}),
    # ---- erratum / corrigendum / addendum instead of the article ---------
    dict(side="original", url=D + "10.1037/0022-3514.94.3.545", n=1,
         title='"Individual differences in the regulation of intergroup bias',
         set={"url": D + "10.1037/0022-3514.94.1.60",
              "title": "Individual differences in the regulation of intergroup bias: The role of "
                       "conflict monitoring and neural signals for control",
              "issue": "1", "pages": "60-74"}),
    dict(side="original", url=D + "10.1017/S2045796019000337", n=1,
         title="A risk calculator to predict adult",
         set={"url": D + "10.1017/S2045796019000283"}),
    dict(side="original", url=D + "10.1093/scan/nsx024", n=1,
         title="Affective facilitation of early visual cortex",
         set={"url": D + "10.1093/scan/nsv058"}),
    dict(side="original", url=D + "10.1371/journal.pone.0101091", n=1,
         title="Correction: The Musicality of Non-Musicians",
         set={"url": D + "10.1371/journal.pone.0089642",
              "title": "The Musicality of Non-Musicians: An Index for Assessing Musical "
                       "Sophistication in the General Population",
              "authors": "Daniel Müllensiefen; Bruno Gingras; Jason Musil; Lauren Stewart",
              "issue": "2", "pages": "e89642"}),
    # The corpus folder for the corrigendum holds Boekel et al. (2015) itself
    # (UvA-DARE copy), which is what these 5 rows were extracted from.
    dict(side="replication", url=D + "10.1016/j.cortex.2017.03.007", n=5,
         title="Corrigendum to “A purely confirmatory replication study",
         set={"url": D + "10.1016/j.cortex.2014.11.019",
              "title": "A purely confirmatory replication study of structural brain-behavior correlations",
              "authors": "Wouter Boekel; Eric-Jan Wagenmakers; Luam Belay; Josine Verhagen; "
                         "Scott Brown; Birte U. Forstmann",
              "volume": "66", "pages": "115-133", "year": "2015"}),
    dict(side="original", url=D + "10.1038/s41598-021-00055-6", n=1,
         title="Individual alpha peak frequency",
         set={"url": D + "10.1038/s41598-021-97303-6"}),
    dict(side="original", url=D + "10.1038/nature10396", n=1,
         title="Post-traumatic stress disorder is associated with PACAP",
         set={"url": D + "10.1038/nature09856", "issue": "7335"}),
    dict(side="original", url=D + "10.1038/mp.2015.118", n=2,
         title="Subcortical brain volume abnormalities",
         set={"url": D + "10.1038/mp.2015.63", "pages": "547-553"}),
    # ---- journal-issue DOI instead of the article ------------------------
    dict(side="original", url=D + "10.1002/pam.2013.32.issue-3", n=1,
         title="An Experimental Test of the Expectancy-Disconfirmation",
         set={"url": D + "10.1002/pam.21702"}),
    dict(side="original", url=D + "10.1111/desc.1998.1.issue-2", n=1,
         title="Parental loss of close family members",
         set={"url": D + "10.1111/1467-7687.00045"}),
    # ---- reply to a comment instead of the article -----------------------
    dict(side="original", url=D + "10.1126/science.1246799", n=1,
         title="Poverty impedes cognitive function",
         set={"url": D + "10.1126/science.1238041", "volume": "341", "issue": "6149"}),
    # ---- retraction-and-replacement notice instead of the article --------
    dict(side="original", url=D + "10.1001/jamapsychiatry.2020.1367", n=1,
         title="Association between childhood anhedonia",
         set={"url": D + "10.1001/jamapsychiatry.2019.0020", "pages": "624-633"}),
]


def latest_csv_filename() -> str:
    lines = VERSION_HISTORY.read_text().strip().split("\n")
    lines = [ln for ln in lines if ln.strip() and not ln.strip().startswith("#")]
    return lines[-1].split("#")[0].strip()


VERSION_NOTE = (
    "repointed DOIs that resolve to the wrong record, from the FLoRA team's 2026-09 sheet "
    "(Lukas Röseler: 'Metascience Observatory -- DOIs pointing to the wrong record'). Each of "
    "the 36 entries was checked by resolving both DOIs in Crossref and comparing title/authors/"
    "journal/volume/issue/pages/year to the row. 35 confirmed and fixed (53 rows on the sheet, 60 with the extras below); "
    "1 rejected: Gerber & Green 2005 APSR 99(2):301-313 'Correction to Gerber and Green (2000), "
    "Replication of Disputed Findings, and Reply to Imai (2005)' is a full article containing "
    "the replication, so csv record 8176 keeps its DOI. Classes fixed: another paper's DOI "
    "(16 entries; ALL 16 had also inherited that paper's AUTHOR LIST through enrichment, and "
    "'Emotion as motion' was really Haeffel 2011 'Motion as motivation'), Faculty Opinions "
    "recommendation (4), eLife author response (1), PCI RR peer-review record (1), errata/"
    "corrigenda/addendum (8), journal-issue DOI (2), reply-to-comment (1), JAMA retraction-and-"
    "replacement notice (1, now the 2019 article DOI, whose landing page carries the replacement), "
    "book review for Hofstede's 1980 book (1; original_url blanked -- the book has no DOI). "
    "Wrong bibliographic fields on the same rows were corrected alongside (authors, title, "
    "issue, pages, volume, year). BEYOND THE SHEET, same defect class: 5 more Eimer (1996) "
    "#EEGManyLabs rows on the PCI RR recommendation/decision records (all 7 N2pc rows now point "
    "at Cortex 190:304-341, 10.1016/j.cortex.2025.05.014; the recommender Maxine Sherman had been "
    "recorded as replication author), and 2 more Hofstede rows on AMR book-review DOIs "
    "(10.2307/257651, 10.5465/AMR.2002.7389951; URL blanked). Row count unchanged. NOT RESOLVED "
    "HERE, needs a dedup decision: (a) the 7 N2pc rows are 3 extractions of the same paper "
    "(form / colour / form>colour) -- 4 are redundant; (b) the 5 rows formerly on the Boekel "
    "corrigendum are study-level duplicates of the 5 Boekel 2015 rows already present (Forstmann, "
    "Kanai social-network, Xu, Kanai distractibility, Westlye), and the Kanai-distractibility and "
    "Xu per-effect rows repointed here overlap those too. Written by "
    "data_ingestor/scripts/fix_flora_wrong_record_dois_2026_10_01.py (dry-run by default; every "
    "change guarded by current URL, row count and title prefix)."
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
        side = ch["side"]
        hits = [i for i, r in enumerate(rows) if r[f"{side}_url"] == ch["url"]]
        if len(hits) != ch["n"]:
            print(f"ERROR: {ch['url']}: expected {ch['n']} rows, found {len(hits)}", file=sys.stderr)
            return 1
        for i in hits:
            if not rows[i][f"{side}_title"].startswith(ch["title"]):
                print(f"ERROR: record {i + 1} title {rows[i][f'{side}_title'][:60]!r} does not start "
                      f"with {ch['title']!r}", file=sys.stderr)
                return 1
            for col, new in ch["set"].items():
                full = f"{side}_{col}"
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
