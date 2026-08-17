#!/usr/bin/env python3
"""2026-08-08 audit fixes for five 3ie rows, verified against the source PDFs in
existing_datasets_processing/3ie_replications/ (see version_history.txt entry).

Surgical csv round-trip (QUOTE_MINIMAL, lineterminator='\\n' — byte-compatible with
the ingestor's pandas output); writes a new timestamped master and archives the old.
"""
import csv
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from data_ingestor import convert_effect_size, archive_superseded_masters

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")
OLD = "replications_database_2026_08_07_194614.csv"


def r_from(es, es_type):
    r = convert_effect_size(es, es_type)
    assert r is not None, (es, es_type)
    return repr(r)


EDITS = {
    # csv physical line -> (assert original_url contains, {col: new_value})
    4025: ("s2352-3018(17)30205-9", {  # RPS0025 TasP / Iwuji
        "description": ("A universal test-and-treat (TasP) intervention providing ART to all "
                        "HIV-positive individuals regardless of CD4 count did not reduce HIV "
                        "incidence at the population level in rural South Africa (adjusted HR "
                        "1.01, 95% CI 0.87-1.17)"),
        "original_es": "1.01", "original_es_type": "HR", "original_es_95_CI": "[0.87, 1.17]",
        "original_p_value_tails": "two",
        "replication_es": "0.99", "replication_es_type": "HR",
        "replication_es_95_CI": "[0.71, 1.37]",
        "replication_p_value": "0.89", "replication_p_value_tails": "two",
        "original_es_r": r_from(1.01, "HR"), "replication_es_r": r_from(0.99, "HR"),
        "explanation": ("The original ANRS 12249 TasP trial found a null result: adjusted HR 1.01 "
                        "(95% CI 0.87-1.17, p=0.89) for HIV incidence in intervention vs control "
                        "clusters (augmented GEE, the trial's primary model). The replication's "
                        "matched augmented-GEE estimate (using the original authors' code) was HR "
                        "0.99 (95% CI 0.71-1.37, p=0.89); their non-augmented GEE gave HR 0.93 "
                        "(0.74-1.18, p=0.57) vs the original's 0.95 (0.75-1.20, p=0.68) (Table 5, "
                        "p.13). The push-button replication reproduced Tables 1-4 and S7A with no "
                        "differences. The authors state: 'We did not find any major discrepancies "
                        "that affected either point estimates or the main conclusion of this "
                        "study' and 'Overall, we found that the results were fairly robust, and "
                        "we were able to replicate the original analyses.' result=success records "
                        "a CONFIRMED NULL. n=14,223 is the HIV-incidence analysis sub-sample (>=2 "
                        "dried-blood-spot samples, first test HIV-negative); 28,419 individuals "
                        "were enrolled at baseline. Row corrected 2026-08-08: the previous "
                        "description asserted the intervention 'reduces HIV incidence' (the "
                        "trial's aim, not its result), and the previous p-values paired the "
                        "original's augmented model (0.89) with the replication's non-augmented "
                        "model (0.57)."),
    }),
    4022: ("10.1257/aer.104.1.183", {  # RPS0022 M-PESA / Jack & Suri
        "original_n": "4562.0",
        "original_es": "0.0917", "original_es_type": "b (unstd)",
        "original_es_95_CI": "[-0.007, 0.191]",
        "original_p_value": "0.07", "original_p_value_type": "=", "original_p_value_tails": "two",
        "replication_es": "0.0917", "replication_es_type": "b (unstd)",
        "replication_es_95_CI": "[-0.007, 0.191]",
        "replication_p_value": "0.07", "replication_p_value_type": "=",
        "replication_p_value_tails": "two",
        "explanation": ("Pure replication by independent re-coding of Jack & Suri (2014) from the "
                        "AER replication data. Table A7 (p.43) reproduces the original Table 4A "
                        "exactly: the headline DiD interaction (M-PESA user x negative shock) on "
                        "log per-capita consumption is 0.0917 (SE 0.0506, p~0.07) in OLS, rising "
                        "to 0.1483 (SE 0.0599, p<0.05) in the preferred specification; N=4,562 "
                        "household-period observations (2,282 households x 2 rounds). The "
                        "author's verdict (p.38): 'I was able to reproduce all of the main "
                        "findings from the original paper, although I discovered some minor "
                        "differences in the code and tables. Accordingly, my pure and push-button "
                        "replication is categorised as comparable but incomplete.' Notable "
                        "finding (p.5): the original's first column claims robust SEs but uses "
                        "conventional OLS SEs - with heteroskedasticity-robust SEs the headline "
                        "coefficient loses significance (SE 0.0717, p=0.201). Some original "
                        "tables could not be replicated for lack of data (Table 2 Panel B; Table "
                        "7A falsification test - proprietary data), and the replication found the "
                        "ROSCA and SACCO estimates switched in the original's Table 8A. Row "
                        "enriched and n corrected 2026-08-08 (4,562 was previously attributed to "
                        "the replication side only; it is the original's regression N, exactly "
                        "reproduced)."),
    }),
    4023: ("10.1257/aer.20141346", {  # RPS0023 Smartcards / Muralidharan
        "description": ("Biometrically authenticated Smartcard payment infrastructure in Andhra "
                        "Pradesh, India reduced the time NREGS beneficiaries spent collecting "
                        "payments and modestly reduced leakage of funds, without hindering access "
                        "to the NREGS and SSP welfare programs"),
        "original_n": "10191", "replication_n": "10191",
        "original_es": "-22", "original_es_type": "b (unstd)",
        "original_es_95_CI": "[-40.0, -4.0]",
        "original_p_value": "0.019", "original_p_value_type": "=", "original_p_value_tails": "two",
        "replication_es": "-22", "replication_es_type": "b (unstd)",
        "replication_es_95_CI": "[-40.0, -4.0]",
        "replication_p_value": "0.019", "replication_p_value_type": "=",
        "replication_p_value_tails": "two",
        "explanation": ("The replication (line-by-line audit of the original Stata do-files "
                        "re-run in Stata 14.1, plus MEA robustness checks) exactly reproduces "
                        "Muralidharan et al. (2016). Effect stored here: Smartcards reduced NREGS "
                        "beneficiaries' time to collect payments by 22 minutes (cluster-robust SE "
                        "9.2, p=0.019, N=10,191 individuals; control mean 112 min; Table A2 p.16 "
                        "- p-values computed by the replicator, absent from the original). Other "
                        "reproduced results: NREGS payment lag -10 days (p=0.005); NREGS survey "
                        "payments +35 Rs (p=0.026); leakage -24 to -25 Rs, marginal (p=0.054-"
                        "0.067) and driven by the over-reporting channel (-0.082, p=0.014; ghost "
                        "households and bribes null); NREGS participation +0.072 (p=0.03). SSP "
                        "effects are null throughout (time to collect p=0.24-0.52; no SSP "
                        "participation estimate exists in the paper). Verdict (p.13): 'Our "
                        "replication is exactly comparable to the findings of Muralidharan and "
                        "colleagues (2016)... we are able to confirm the original findings', with "
                        "robustness 'comparable in 90 percent of the cases'; one documented "
                        "contradiction (footnote 13, p.9): the replicator's TOT decomposition "
                        "finds a significant Smartcard/non-Smartcard difference in time-to-"
                        "collect where the original's Table A7 equality test found none. "
                        "Description corrected 2026-08-08 (previously claimed improved "
                        "participation in NREGS AND SSP and unqualified time savings; the SSP "
                        "effects are null)."),
    }),
    4024: ("nejmoa1105243", {  # RPS0024 HPTN 052 / Cohen
        "description": ("Early initiation of antiretroviral therapy (ART) reduces the risk of "
                        "genetically linked HIV-1 transmission to uninfected partners among "
                        "serodiscordant couples by 96% compared with delayed therapy"),
        "original_es": "0.04", "original_es_type": "HR", "original_es_95_CI": "[0.01, 0.27]",
        "original_p_value_tails": "two",
        "replication_es": "0.04", "replication_es_type": "HR",
        "replication_es_95_CI": "[0.01, 0.27]",
        "replication_p_value_tails": "two",
        "original_es_r": r_from(0.04, "HR"), "replication_es_r": r_from(0.04, "HR"),
        "explanation": ("Pure replication using the original authors' data and methods reproduced "
                        "the main results: linked-transmission HR 0.04 (95% CI 0.01-0.27), "
                        "identical to the original (Table 3, p.12; multivariate Cox 0.04 [0.01-"
                        "0.28], Table 4, p.16) - a 96% relative reduction; any-transmission HR "
                        "0.11 (89% reduction) and composite clinical events also reproduced. The "
                        "replication does not print a separate p-value for the primary outcome; "
                        "replication_p<0.001 mirrors the original's printed value (the CI "
                        "excludes 1, and the only printed replication p is <0.01 for the African-"
                        "subgroup MEA re-estimate, p.18). Conclusion (p.40): 'In general - except "
                        "for Figure 2 in the original paper, where we found a major difference "
                        "with our replication - the pure replication confirmed the main findings "
                        "of the original paper.' The Figure 2 discrepancy concerns the numbers-at-"
                        "risk tables (replication starts with 1,718 uninfected / 1,754 infected "
                        "vs the original's 1,775 / 1,763, due to missing duration values); the "
                        "authors write that if confirmed 'an errata should be submitted to the "
                        "New England Journal of Medicine' (p.39). The original authors declined "
                        "to share male-circumcision and ART-adherence data. Row enriched "
                        "2026-08-08."),
    }),
    1971: ("qjw025", {  # RPS20 Kenya UCT / Haushofer & Shapiro (journal version row)
        "replication_type": "direct",
        "replication_authors": "Hongmei Wang; Fang Qiu; Jiangtao Luo",
        "original_n": "1440", "replication_n": "1440",
        "source": ("3ie Replication Paper 20 (doi:10.23846/RPS0020), Wang, Qiu & Luo, Jan 2019; "
                   "journal version: Journal of Development Effectiveness, "
                   "doi:10.1080/19439342.2019.1666900. Audited against the 3ie PDF 2026-08-08."),
        "explanation": ("Pure replication of Haushofer & Shapiro (2016) using the authors' "
                        "cleaned dataset, re-coded in different software: 'We produced the exact "
                        "same results for means, coefficients and standard errors as reported in "
                        "Table II for all eight indices in all five columns' (p.12). Headline "
                        "treatment effects (Table 2, p.12; N=940 households, 1,474 individuals "
                        "for psychological well-being): non-land assets +301.51 USD PPP (SE "
                        "27.25), non-durable expenditure +35.66 (5.85), monthly revenue +16.15 "
                        "(5.88), food security index +0.26 SD (0.06), psychological well-being "
                        "+0.26 SD (0.05), all FWER p<=0.02; health, education and female "
                        "empowerment indices null. Original design: 120 villages in Rarieda, "
                        "Kenya; 1,440 households (503 treatment / 505 spillover / 432 pure "
                        "control). Caveats from the replication's extensions: FWER-adjusted "
                        "p-values differ slightly (different re-ranking algorithm); the food "
                        "security and psychological well-being main effects lose significance "
                        "once village-x-treatment interactions are added (Table 11, p.24); PCA "
                        "returns multiple factors for the food security, health and psych well-"
                        "being indices; the index-construction formulas were absent from the "
                        "authors' code and the original authors did not respond to requests. "
                        "Overall verdict (p.i): 'Our pure replication results are consistent with "
                        "the findings published in the original study.'"),
    }),
}

VERSION_NOTE = (
    "audit pass over all 15 3ie-tagged rows against the source PDFs (three independent extraction "
    "agents; the 4 rows added 2026-08-07 re-confirmed 15/15 numbers). Fixed and enriched 5 rows, all "
    "now validated=yes (Dan Elton): (1) csv line 4025 (RPS0025, TasP/Iwuji) -- description said the "
    "intervention 'reduces HIV incidence' but the original was a NULL (aHR 1.01 [0.87-1.17] p=0.89); "
    "description corrected, and replication_p 0.57->0.89 (0.57 was the non-augmented GEE paired "
    "against the original's augmented-model 0.89); added HR effect sizes both sides. (2) line 4022 "
    "(RPS0022, M-PESA) -- original_n filled with 4562 (was mis-attributed to replication side only); "
    "added the 0.0917 (SE 0.0506) DiD effect and the paper's robust-SE finding (p=0.201); noted 3ie's "
    "own label 'comparable but incomplete'. (3) line 4023 (RPS0023, Smartcards) -- description "
    "overstated (claimed improved participation in NREGS AND SSP; SSP effects are null, no SSP "
    "participation estimate exists); corrected, added -22 min time-to-collect effect (p=0.019, "
    "N=10,191). (4) line 4024 (RPS0024, HPTN 052) -- added HR 0.04 [0.01-0.27] both sides, "
    "'genetically linked' qualifier, and the paper's Figure-2 major-discrepancy/NEJM-erratum note. "
    "(5) line 1971 (RPS20, Kenya UCT) -- replication_type 'direct or close' (illegal enum) -> "
    "'direct'; added missing author Fang Qiu, n=1440, source with both DOIs, and a full explanation. "
    "ALSO fixed in data_ingestor.py (not the CSV): the chi2->r branch now refuses chi2>N (phi<=1 is a "
    "mathematical bound) and convert_effect_size refuses any |r|>1 from every branch, so STEP 5b can "
    "no longer re-create the impossible es_r back-fills on lines 7488/7535 (verified: a full-master "
    "calculate_effect_sizes dry run now fills 0 cells). Row count unchanged (8450)."
)


def main():
    old_path = os.path.join(DATA_DIR, OLD)
    with open(old_path, newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))
    ix = {c: i for i, c in enumerate(rows[0])}

    for line, (url_frag, changes) in EDITS.items():
        row = rows[line - 1]
        assert url_frag in row[ix["original_url"]], (line, row[ix["original_url"]])
        for col, val in changes.items():
            row[ix[col]] = val
        row[ix["validated"]] = "yes"
        row[ix["validated_person"]] = "Dan Elton"

    ts = datetime.now().strftime("%Y_%m_%d_%H%M%S")
    new_name = f"replications_database_{ts}.csv"
    new_path = os.path.join(DATA_DIR, new_name)
    with open(new_path, "w", newline="", encoding="utf-8") as f:
        csv.writer(f, lineterminator="\n").writerows(rows)

    with open(os.path.join(DATA_DIR, "version_history.txt"), "a", encoding="utf-8") as f:
        f.write(f"{new_name} # {VERSION_NOTE}\n")

    archive_superseded_masters(new_name)
    print(f"Wrote {new_path} ({len(rows) - 1} rows), updated version_history, archived {OLD}")


if __name__ == "__main__":
    main()
