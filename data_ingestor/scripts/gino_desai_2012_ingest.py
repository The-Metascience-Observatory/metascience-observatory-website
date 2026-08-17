"""Build the staging CSV for the Gino & Desai (2012) "Memory Lane and Morality"
replications (2026-08-12).

Writes gino_desai_2012_ingest.csv, which is then fed to data_ingestor.py.

Three rows, all standalone (no replication_initiative_tag):
  1. Shin (2021) Study 1 -- moral purity            -> success
  2. Shin (2021) Study 1 -- prosocial motivation    -> success
  3. Szabo-Douat (2020) Study 2 -- lending behavior -> inconclusive

Deliberately EXCLUDED: Laguna, Kedra & Mazur-Socha (2021), Front. Psychol.
12:661336. See the `explanation` on row 3 and the version_history note.

Every statistic below was read out of primary text:
  * Gino & Desai 2012, published version, Harvard DASH accepted manuscript
    (5 experiments -- NOT the 4-experiment HBS working paper 11-079)
  * Shin 2021, Korean full text, doi:10.14695/KJSOS.2021.24.1.73
  * Szabo-Douat 2020, CUNY Academic Works full text
"""
import csv
import pathlib

COLUMNS = [
    "original_url", "replication_url", "description", "result", "replication_type",
    "original_authors", "original_title", "original_journal", "original_volume",
    "original_issue", "original_pages", "original_year",
    "replication_authors", "replication_title", "replication_journal",
    "replication_volume", "replication_issue", "replication_pages", "replication_year",
    "original_n", "original_es", "original_es_type", "original_es_95_CI",
    "original_p_value", "original_p_value_type", "original_p_value_tails",
    "replication_n", "replication_es", "replication_es_type",
    "original_es_r", "replication_es_r", "replication_es_95_CI",
    "replication_p_value", "replication_p_value_type", "replication_p_value_tails",
    "field", "discipline", "subdiscipline", "tags", "validated", "validated_person",
    "replication_initiative_tag", "source", "explanation", "confidence",
    "ai_version", "upstream_effect_id",
]

ORIGINAL = {
    "original_url": "https://doi.org/10.1037/a0026565",
    "original_authors": "Francesca Gino; Sreedhari D. Desai",
    "original_title": ("Memory lane and morality: How childhood memories promote "
                       "prosocial behavior"),
    "original_journal": "Journal of Personality and Social Psychology",
    "original_volume": "102",
    "original_issue": "4",
    "original_pages": "743-758",
    "original_year": "2012",
    "original_n": "110",
}

SHIN = {
    "replication_url": "https://doi.org/10.14695/KJSOS.2021.24.1.73",
    "replication_authors": "Hong Im Shin",
    "replication_title": "Autobiographical memory of childhood and prosocial behaviors",
    "replication_journal": "Science of Emotion and Sensibility",
    "replication_volume": "24",
    "replication_issue": "1",
    "replication_pages": "73-90",
    "replication_year": "2021",
    "replication_n": "117",
}

# Provenance sentence shared by all three rows.
PROVENANCE = (
    "The original paper's data provenance is documented at manycoauthors.org/gino/105: "
    "co-author Sreedhari Desai reports that Gino was involved in data collection for all "
    "five experiments, that co-authors never held the raw data, and that no data for "
    "reproducing the results of any experiment is available. The paper is NOT retracted "
    "and carries no expression of concern (checked PubMed 22181000, 2026-08-12). "
    "Recorded here because it bears on what a replication of this paper can and cannot "
    "settle, not as a claim about the original's validity."
)

VERSION_WARNING = (
    "IMPORTANT for anyone re-checking these numbers: the freely circulating HBS working "
    "paper 11-079 has FOUR experiments and is NOT the published article. The published "
    "JPSP version has FIVE: 1 Helping Others, 2 Donating Money to a Good Cause, "
    "3 Manipulating Moral Purity (new, absent from the working paper), 4 Judging and "
    "Punishing the Actions of Others (= working paper Exp 3), 5 Good and Bad Childhood "
    "Memories (= working paper Exp 4). Working-paper Exp 2 is also a DIFFERENT donation "
    "study from published Exp 2 (N=103 with a grocery-store control vs N=87 with a "
    "high-school control). All original-side values in this row were read from the "
    "published version (Harvard DASH accepted manuscript, "
    "nrs.harvard.edu/urn-3:HUL.InstRepos:10996789), whose Experiment 1 is identical to "
    "working-paper Experiment 1."
)

SHIN_COMMON = (
    "REPLICATION DESIGN. Shin (2021) Study 1: 117 undergraduates at a Korean four-year "
    "university (M_age 20.03, 40 men / 77 women), recruited via a campus board, randomly "
    "assigned to recall childhood experiences (n=58) or recent everyday experiences "
    "(n=59), online, ~15 min, paid a 5,000-won coffee voucher. Both conditions first "
    "wrote a disguising essay about their morning routine, exactly as in Gino & Desai. "
    "Shin states the childhood-condition prompt follows Gino & Desai (2012) and uses "
    "their two-item moral purity scale, citing their alpha of .84 (alpha = .74 here, on a "
    "9-point rather than 7-point scale). Manipulation check t(115)=7.42, p<.001. "
    "Affect was measured to rule out a mood account and, as in Gino & Desai Experiments "
    "1-3, did not differ: positive affect 6.36 (1.49) vs 5.93 (1.43), t(115)=1.586, "
    "p=.116; negative affect 4.60 (1.23) vs 4.38 (1.86), t(115)=.624, p=.534. "
    "Shin's Study 2 is NOT a replication and is deliberately not entered here: it "
    "manipulates construal level with childhood recall in BOTH arms, so it contains no "
    "childhood-vs-control contrast."
)

ES_METHOD = (
    "EFFECT-SIZE DERIVATION. Replication d computed from the reported test statistic as "
    "d = t * sqrt(1/n1 + 1/n2) with n1=58, n2=59; 95% CI as d +/- 1.96*SE with "
    "SE = sqrt((n1+n2)/(n1*n2) + d^2/(2*(n1+n2))) (Hedges & Olkin). Left "
    "original_es_r/replication_es_r blank for the ingestor to compute."
)

rows = []

# ---------------------------------------------------------------- row 1
rows.append({
    **ORIGINAL, **SHIN,
    "description": (
        "Recalling and writing about memories from one's own childhood, rather than a "
        "neutral recent event, raised self-reported feelings of moral purity (the mean of "
        "'I feel innocent' and 'I feel morally pure')."
    ),
    "result": "success",
    "replication_type": "close experiment",
    "original_es": "0.86",
    "original_es_type": "d",
    "original_es_95_CI": "[0.469, 1.251]",
    "original_p_value": "0.001",
    "original_p_value_type": "<",
    "original_p_value_tails": "two",
    "replication_es": "0.381",
    "replication_es_type": "d",
    "replication_es_95_CI": "[0.015, 0.747]",
    "replication_p_value": "0.041",
    "replication_p_value_type": "=",
    "replication_p_value_tails": "two",
    "field": "social sciences",
    "discipline": "psychology",
    "subdiscipline": "social psychology",
    "tags": ("childhood memories; moral purity; prosocial behavior; autobiographical "
             "memory; priming; cross-cultural replication"),
    "validated": "yes",
    "validated_person": "Dan Elton",
    "source": (
        "Manual entry 2026-08-12 from primary text on both sides. Original: Gino & Desai "
        "(2012) published JPSP version, Experiment 1, Moral purity paragraph, via the "
        "Harvard DASH green open-access copy (nrs.harvard.edu/urn-3:HUL.InstRepos:10996789, "
        "OpenAlex oa_status=green). Replication: Shin (2021) Study 1, section 3.2.3, "
        "doi:10.14695/KJSOS.2021.24.1.73 (Korean, open access via koreascience.kr). "
        "Identified from the co-author transparency page manycoauthors.org/gino/105."
    ),
    "explanation": (
        "ORIGINAL. Gino & Desai (2012) published Experiment 1: 113 undergraduates at a "
        "southeastern US university, 110 analysed after excluding 3 who voiced suspicion; "
        "childhood-memory essay vs last-visit-to-the-supermarket essay. Moral purity "
        "M=3.73 (SD=1.79) vs M=2.38 (SD=1.41), t(108)=4.42, p<.001, d=0.86 (d reported by "
        "the authors). The paper gives no CI and does not report the per-condition n; the "
        "CI entered here is computed from d=0.86 with N=110 and is insensitive to the "
        "split (50/60 through 60/50 all give [0.468, 1.252] to three decimals). "
        + VERSION_WARNING + " "
        + SHIN_COMMON + " "
        "REPLICATION RESULT. Moral purity was higher after childhood recall, M=6.14 "
        "(SD=1.98), than after recent-everyday recall, M=5.70 (SD=1.57), t(115)=2.06, "
        "p=.041, giving d=0.381, 95% CI [0.015, 0.747], r=0.187. Same direction as the "
        "original at roughly half the magnitude (original d=0.86, r=0.395); the "
        "replication CI excludes zero but also excludes the original point estimate. "
        "DISCREPANCY IN THE REPLICATION REPORT, recorded rather than smoothed over: "
        "Shin's reported means and SDs are not consistent with the reported test. The "
        "pooled SD implied by 1.98 and 1.57 is 1.785, giving d=0.247 and t(115)=1.33 "
        "(p=.185), not t=2.06 (p=.041). The reported t and p ARE mutually consistent "
        "(t=2.06 at df=115 is p=.0417 two-tailed), so the SDs are the suspect element. "
        "This row is therefore entered from the test statistic, which is the quantity "
        "the two reported values agree on. Note this is specific to the moral-purity "
        "measure: the three other Study 1 contrasts all reconcile to within d=0.01 "
        "(prosocial motivation d=0.402 from F vs 0.403 from means/SDs; informal prosocial "
        "0.468 vs 0.468; formal prosocial 0.104 vs 0.095). If the SDs rather than the t "
        "are correct, this row becomes a failure rather than a success, so it is worth "
        "writing to Shin. " + ES_METHOD + " " + PROVENANCE
    ),
})

# ---------------------------------------------------------------- row 2
rows.append({
    **ORIGINAL, **SHIN,
    "description": (
        "Recalling and writing about memories from one's own childhood, rather than a "
        "neutral recent event, increased prosocial behavior toward the experimenter: 75% "
        "of participants in the childhood condition agreed to help with an extra unpaid "
        "task, versus 54.5% of controls."
    ),
    "result": "success",
    "replication_type": "conceptual",
    "original_es": "0.21",
    "original_es_type": "r",
    "original_p_value": "0.03",
    "original_p_value_type": "=",
    "original_p_value_tails": "two",
    "replication_es": "0.402",
    "replication_es_type": "d",
    "replication_es_95_CI": "[0.035, 0.768]",
    "replication_p_value": "0.032",
    "replication_p_value_type": "=",
    "replication_p_value_tails": "two",
    "field": "social sciences",
    "discipline": "psychology",
    "subdiscipline": "social psychology",
    "tags": ("childhood memories; moral purity; prosocial behavior; helping; "
             "autobiographical memory; priming; cross-cultural replication"),
    "validated": "yes",
    "validated_person": "Dan Elton",
    "source": (
        "Manual entry 2026-08-12 from primary text on both sides. Original: Gino & Desai "
        "(2012) published JPSP version, Experiment 1, Prosocial behavior paragraph, via "
        "the Harvard DASH green open-access copy "
        "(nrs.harvard.edu/urn-3:HUL.InstRepos:10996789). Replication: Shin (2021) Study 1, "
        "section 3.2.4, doi:10.14695/KJSOS.2021.24.1.73. Identified from the co-author "
        "transparency page manycoauthors.org/gino/105."
    ),
    "explanation": (
        "ORIGINAL. Gino & Desai (2012) published Experiment 1, N=110 analysed: 75% of the "
        "childhood-memory condition agreed to help the experimenter with an optional extra "
        "task versus 54.5% of the supermarket control, chi2(1, N=110)=4.72, p=.03, "
        "Cramer's V=.21 (reported by the authors). ES-TYPE LABEL: entered as 'r', not as "
        "'Cramer V', because for a 2x2 table Cramer's V is identical to phi, which is "
        "exactly the Pearson correlation between the binary condition and the binary "
        "outcome - so 0.21 is already an r and no conversion is involved. The label also "
        "matters mechanically: 'Cramer V' is unmapped in the ingestor's ESTYPE_MAP (it "
        "converts to None, which is why the 5 existing 'Cramer V' rows in the master carry "
        "no es_r), and 'phi' converts correctly but is absent from the correlation family "
        "in codebook_rules.json (which lists 'phi 2x2', a spelling the converter in turn "
        "does not recognise), so it trips an es_type_unmapped flag. 'r' is the one label "
        "that is both mathematically exact here and clean through both checks. "
        "Cross-check: "
        "sqrt(chi2/N) = sqrt(4.72/110) = 0.2071, matching the reported V=.21. The paper "
        "also reports an odds ratio of 2.35; the rounded percentages imply 2.50, a "
        "rounding artefact rather than a discrepancy. " + VERSION_WARNING + " "
        + SHIN_COMMON + " "
        "REPLICATION RESULT. Shin measured willingness to perform nine prosocial acts "
        "(four formal: charity campaign, organised volunteering, blood donation, "
        "institutional giving; five informal: giving up a seat, listening to a friend's "
        "troubles, lending an object, looking after an acquaintance's home, carrying a "
        "heavy load) in a 2 (prime) x 2 (behaviour type) mixed ANOVA. The priming main "
        "effect was significant: childhood M=6.69 (SD=1.26) vs recent M=6.16 (SD=1.37), "
        "F(1,115)=4.716, p=.032, eta-squared=.039, giving d=0.402, 95% CI [0.035, 0.768], "
        "r=0.197. Three independent routes agree: t=sqrt(F)=2.172 gives d=0.402; the "
        "means and SDs give d=0.403; sqrt(eta-squared)=0.1975 matches the r. "
        "DECOMPOSITION, reported here rather than as separate rows because it is one "
        "ANOVA: the effect is carried entirely by the informal behaviours, 7.50 (1.00) vs "
        "6.98 (1.21), t(115)=2.529, p=.013, d=0.468; formal behaviours were flat, 5.77 "
        "(1.81) vs 5.62 (1.33), t(115)=.56, p=.60, d=0.104. The prime x behaviour-type "
        "interaction was not significant, F(1,115)=.513, p=.475. Shin reads the split as "
        "formal giving being more deliberative and so less open to an implicit prime. "
        "WHY 'conceptual' RATHER THAN 'close': the manipulation follows Gino & Desai, but "
        "the outcome is self-reported motivation to act rather than an observed behavioural "
        "choice, which is the specific thing the original measured, and the sample is "
        "Korean rather than US. Coded a success on the effect as stated, with the caveat "
        "that a behavioural-intention measure is a weaker test than the original's "
        "behavioural one. " + ES_METHOD + " " + PROVENANCE
    ),
})

# ---------------------------------------------------------------- row 3
rows.append({
    **ORIGINAL,
    "replication_url": "https://academicworks.cuny.edu/gc_etds/4092",
    "description": (
        "Recalling and writing about memories from one's own childhood, rather than a "
        "neutral recent event, increases prosocial behavior toward others -- here tested "
        "as willingness to lend one's own possessions."
    ),
    "result": "inconclusive",
    "replication_type": "conceptual",
    "replication_authors": "Teodora Szabo-Douat",
    "replication_title": ("\"Caring is sharing\": The effect of childhood memories on "
                          "consumers' lending behavior"),
    "replication_journal": ("PhD dissertation, The Graduate Center, City University of "
                           "New York"),
    "replication_year": "2020",
    "replication_n": "93",
    "field": "social sciences",
    "discipline": "psychology",
    "subdiscipline": "consumer psychology / marketing",
    "tags": ("childhood memories; prosocial behavior; lending; sharing economy; "
             "rebelliousness; moderation; unpublished dissertation"),
    "validated": "yes",
    "validated_person": "Dan Elton",
    "source": (
        "Manual entry 2026-08-12 from the full dissertation text, CUNY Academic Works "
        "academicworks.cuny.edu/gc_etds/4092 (advisor Sankar Sen; committee Ana "
        "Valenzuela, Stephen J. Gould, Gita Venkataramani Johar). Study 2, the first of "
        "two studies measuring actual lending behavior. Original side: Gino & Desai (2012) "
        "published JPSP version, Experiment 1, via the Harvard DASH copy. Identified from "
        "the co-author transparency page manycoauthors.org/gino/105."
    ),
    "explanation": (
        "WHY THIS IS CODED INCONCLUSIVE, AND WHY EFFECT-SIZE CELLS ARE BLANK. Across all "
        "five studies the dissertation reports ONLY an interaction between the childhood-"
        "memories manipulation and trait rebelliousness. No unconditional main effect of "
        "childhood memories on lending is reported anywhere in the document, so there is "
        "no quantity that can be set against Gino & Desai's main effect, and no comparable "
        "Pearson r exists to enter. Same treatment as the arsenic-life and Betatrophin "
        "rows: the numbers live here instead. "
        "THIS ROW'S STUDY. Study 2, N=93 undergraduates (46 female, M_age 22.05) who had "
        "been asked by email to bring their own calculator to the lab; after the essay "
        "manipulation they were asked whether they would lend it to another student, a "
        "yes/no choice - real behavior, not intention. Logistic regression (PROCESS model "
        "1): childhood-memories x rebelliousness b=-.69, SE=.31, z=-2.22, p=.027. "
        "Johnson-Neyman: a significant POSITIVE effect only at or below 1.32 on the "
        "5-point rebelliousness scale, which is 5.38% of the sample (b=.96, SE=.49, "
        "z=1.96, p=.05), and a significant NEGATIVE effect at or above 4.06, a further "
        "6.45% (b=-.93, SE=.47, z=-1.96, p=.05). For roughly 88% of participants the "
        "manipulation did nothing, and among the most rebellious it significantly REDUCED "
        "lending. "
        "THE OTHER FOUR STUDIES, all the same shape and all consistent with each other: "
        "Study 1, N=114 MTurk, lending intentions on a mock sharing website, interaction "
        "b=-.45, SE=.19, t=-2.37, p=.019, positive simple effect only at or below 2.20 "
        "(28.07% of the sample); number of items willing to lend, b=-.21, SE=.045, "
        "z=-4.56, p<.01. Study 3, N=242 MTurk, interaction on willingness to lend a vacuum "
        "cleaner b=-.55, and on general app-based lending b=-.52, SE=.25, t=-2.08, p=.039, "
        "positive simple effect at or below 2.29 (32.23%); interaction on self-community "
        "connectedness b=-.38. Study 4, N=197 MTurk, interaction on lending intentions "
        "b=-.34. Study 5, N=133, calculator lending again, interaction b=-1.03, SE=.45, "
        "z=-2.31, p=.021, with the same two-tailed crossover. "
        "RELATION TO THE ORIGINAL. The manipulation is described as 'created based on the "
        "manipulations used by Wildschut et al. (2006), Gino and Desai (2012), and "
        "Lasaleta, Sedikides, and Vohs (2014)' - an adaptation drawing on three sources, "
        "not a reuse of the original protocol. The dependent variable is lending one's own "
        "possessions rather than helping or donating. The proposed mechanism is self-"
        "community connectedness, and MORAL PURITY IS NEVER MEASURED, so the original's "
        "mediator goes untested. Study 4 does run the same nostalgia-as-mediator test that "
        "Gino & Desai ran, citing them, and likewise finds no mediation by nostalgia. "
        "Desai's statement on manycoauthors.org/gino/105 describes this dissertation as "
        "having 'findings that align with Gino and Desai (2012)'. That holds only for the "
        "less-rebellious portion of each sample; in the behavioural studies the aligned "
        "region is a small minority of participants and the effect reverses at the other "
        "tail. "
        "WHY THE THIRD WORK CITED ON THAT PAGE IS NOT IN THE DATABASE. Laguna, Kedra & "
        "Mazur-Socha (2021), Front. Psychol. 12:661336, doi:10.3389/fpsyg.2021.661336, was "
        "assessed on 2026-08-12 and deliberately NOT entered. Both of its arms are active "
        "- a 'Three Good Things for Others' intervention versus a childhood-memories "
        "placebo - with no inert control, so no contrast in the design isolates childhood-"
        "memory recall. The between-group tests are flat: Time x Group F(3,264)=0.25, "
        "p=0.844; Group F(1,88)=0.80, p=0.778. The claim that it supports Gino & Desai "
        "rests entirely on an uncontrolled within-arm pre-post rise in the placebo group "
        "(SVO M=5.96 at T0 to 6.67 at T1, p=.041, and 6.96 at T3, p=.011) across four "
        "measurement points, in a study where 89 of 303 recruited participants (29.4%) "
        "completed all four. It can adjudicate the original effect in neither direction. "
        "Do not add it later without reading this note. " + PROVENANCE
    ),
})

out = pathlib.Path(__file__).resolve().parents[1] / "gino_desai_2012_ingest.csv"
with out.open("w", newline="", encoding="utf-8") as fh:
    w = csv.DictWriter(fh, fieldnames=COLUMNS, extrasaction="raise")
    w.writeheader()
    for r in rows:
        w.writerow({c: r.get(c, "") for c in COLUMNS})

print(f"wrote {out} ({len(rows)} rows)")
for i, r in enumerate(rows, 1):
    print(f"  {i}. {r['result']:12s} {r['replication_type']:16s} "
          f"{r['replication_authors']} -- explanation {len(r['explanation'])} chars")
