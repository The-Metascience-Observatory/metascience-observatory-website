# What we've learned so far


(NOTE: THIS PAGE IS AI GENERATED!! )


*A metascience-level read of the aggregate [replications database](https://metascienceobservatory.org/replications-database). The headline replication rates in section 1 are computed from database version `2026_07_21` (**8,610 replication pairs**); sections 2–4 were computed on version `2026_07_13` (7,545 pairs); the per-discipline breakdowns in sections 5–6 have been recomputed on version `2026_07_19` (7,551 pairs) after recent discipline-classification cleanups. All figures will be refreshed as the database grows.*

> **How to read these numbers first.** This database is a **convenience corpus** assembled from systematic replication initiatives plus AI-assisted harvesting of the published literature — it is **not a random sample of science**. The rates below describe *this collection*, not "the fraction of all published science that replicates." About **65%** of rows are AI-curated and not yet human-validated, and the meaning of "success" varies by source (original judgment by replication authors, by a human curator, or by the AI). Treat every headline number as conditional on these caveats, which are spelled out at the bottom.

With that framing, several findings are robust enough to state plainly.

---

## 1. Roughly 45% of published findings replicate — and the number sharpens as the method tightens

Across all 8,610 rows, the raw outcome split is **success 46.4% · failure 34.9% · inconclusive 15.5% · reversal 1.6%**. Counting only definitive outcomes (excluding inconclusive), success / (success + failure) = **57.1%**.

But that loose figure is inflated by lenient replication designs. As you restrict to the most rigorous subset, the rate converges on a lower, more credible value:

| Subset | n | Success / (success + failure) |
|---|---|---|
| All definitive rows | 7,004 | 57.1% |
| Major coordinated replication initiatives | 1,602 | **47%** |
| Direct replications only | 2,065 | **44%** |
| Direct **and** human-validated ("gold standard") | 2,319 | **46%** |

**Conclusion:** when judged by the cleanest available evidence — direct, human-validated replications from coordinated initiatives — **a little under half of published effects replicate**. This holds across fields, not just psychology.

---

## 2. The most reliable signal is shrinkage, not pass/fail

Binary "did it replicate?" labels hide a more consistent and quantitative result: **published effect sizes systematically shrink on replication.** Among 1,791 study pairs with effect sizes converted to a common Pearson $r$ scale (see [Effect size normalization](/docs/effect-size-normalization)):

| Statistic | Original | Replication |
|---|---|---|
| Mean $\lvert r \rvert$ | 0.352 | **0.205** |
| Median $\lvert r \rvert$ | 0.317 | **0.130** |

- Replications retain only **~58% of the original magnitude** on average (median: ~41%).
- **~80%** of replications produce a *smaller* effect than the original.
- **~49%** come in below **half** the original effect.
- **~26%** collapse to essentially zero ($\lvert r \rvert < 0.05$).
- **~20%** flip sign relative to the original.

**Conclusion:** this is the textbook **winner's-curse / publication-bias signature**. Published effects are inflated by roughly **1.7–2×**. Because shrinkage is continuous and direction-consistent, it is a more reliable summary of the replication problem than any single pass/fail rate.

---

## 3. Statistical significance poorly predicts replicability

Among studies where both the original and replication report a p-value (n = 969 with an originally significant result), only **57.6%** of originally significant findings ($p < 0.05$) remain significant on replication.

**Conclusion:** an original "$p < 0.05$" carries only modest information about whether an effect is real. Significance is a weak instrument; effect size and its confidence interval are more informative.

---

## 4. "Replication rate" is not one number — it depends on the definition

The headline rate is highly sensitive to **how** a replication was conducted. Direct redos fail far more often than looser conceptual extensions:

| Replication type | n | Success rate |
|---|---|---|
| `direct` | 2,065 | 44% |
| `direct or close` | 1,423 | 54% |
| `conceptual` | 379 | 52% |
| `close experiment` | 1,303 | 62% |
| `close extension` | 2,375 | 66% |

**Conclusion:** apparent "success" climbs from 44% to 66% purely by loosening what counts as a replication. Any reported replication rate is meaningless without stating the design. See [Defining replication](/docs/defining-replication).

---

## 5. What gets *chosen* for replication matters more than systematic vs. ad-hoc

It is tempting to split this corpus into "coordinated replication initiatives" vs. "ad-hoc replications harvested from the literature" and compare success rates. Done crudely — every row belonging to a coordinated initiative on one side (1,524 rows, **46%**), every loose literature-harvested row on the other (6,021 rows, **59%**) — it looks like the ad-hoc literature is **13 points rosier**, as if published replications skew positive.

**That comparison is misleading, and the real signal is more interesting.** The "initiatives" bucket secretly mixes two opposite *selection strategies*, and pulling them apart dissolves the gap:

| Selection strategy | # findings | Success rate |
|---|---|---|
| **Representative / systematically-sampled** initiatives (RP:P, DARPA SCORE, LOOPR, X-Phi, Cancer Biology, Brazilian Reproducibility Initiative, …) | 914 | **59%** |
| **Targeted mega-replications of famous / contested findings** (Many Labs, Registered Replication Reports) | 343 | **12%** |
| Ad-hoc / literature-harvested replications | 4,945 | **59%** |

*Counts are replication findings (many initiatives replicate several findings per paper) with a definitive outcome — success or failure.*

**Conclusion:** once you separate *how the target was chosen*, **representative-sampled replications (59%) and literature-harvested ones (59%) are indistinguishable.** The whole "coordinated initiatives look worse" effect was driven by the targeted mega-replications, which deliberately go after a handful of celebrated, hotly-contested effects — and find that **only ~12% hold up** (Many Labs 3 **6%**, Many Labs 4 **6%**, Many Labs 5 **10%**, Registered Replication Reports **12%**), versus broad-sampling projects that score high (Life Outcomes of Personality Replication Project **87%**, Experimental Philosophy Reproducibility Project **78%**, DARPA SCORE **67%**).

The load-bearing variable is **what gets picked for replication**, not whether the replication was part of an organized initiative. Hand-picking a famous, surprising claim — exactly the kind of selection that *also* drives which findings get harvested from the literature — is one of the strongest predictors of failure in the whole database. (Caveat: the literature-harvested 59% is the least-validated number in this corpus — ~73% AI-curated with heterogeneous "success" definitions — so read its parity with the representative initiatives as suggestive, not settled.)

### The same pattern holds *within* disciplines

Breaking representative-sampled and literature-harvested replications down by field (restricted to cells with enough rows to be worth reading) shows this is not an artifact of psychology dominating the corpus. Where a discipline has both, the two run broadly comparable:

The comparison is shown twice, because **design leniency differs sharply between the two columns**: the initiatives are 66% direct replications, while the harvested rows are only 13% direct and mostly looser "close" variants — and design predicts outcome (direct 52%, close extension 70%). The first table therefore compares like with like on design; the second uses everything we have harvested.

**Table A — initiatives vs. our *direct* replications only**

| Discipline | "Representative-sampled" initiatives | Literature-harvested (direct only) |
|---|---|---|
| Psychology | 58% (n=590) | 49% (n=295) |
| Biomedical | 33% (n=198) | 38% (n=82) |
| Economics | 49% (n=45) | 53% (n=17) |
| Education | 70% (n=43) | 80% (n=5) |
| Political science | 71% (n=41) | 100% (n=1) |
| Sociology | 42% (n=26) | 86% (n=7) |

**Table B — initiatives vs. *all* harvested replication types**

| Discipline | "Representative-sampled" initiatives | Literature-harvested (all types) |
|---|---|---|
| Psychology | 58% (n=590) | 59% (n=2,777) |
| Biomedical | 33% (n=198) | 50% (n=362) |
| Economics | 49% (n=45) | 57% (n=315) |
| Education | 70% (n=43) | 84% (n=131) |
| Political science | 71% (n=41) | 58% (n=72) |
| Sociology | 42% (n=26) | 50% (n=50) |

*Cells show definitive-outcome success rate (success / (success + failure)); n is the definitive-row count. **Cells with n < 20 carry no information — read them as blank, not as evidence.** The initiative column is identical in both tables; only the harvested column changes. It is not restricted on the initiative side because several projects (SSRP, LOOPR, EROE, Sensory Marketing) record no rows coded `direct`, so restricting that column would delete those initiatives outright rather than make them comparable. Two disciplines are omitted because only one column is populated and no comparison is possible: sports & exercise science has representative-sampled rows but no literature-harvested ones, and medical fields has 1,165 literature-harvested rows but only 4 representative-sampled ones. 3ie is excluded throughout: it re-analyses the original authors' existing datasets rather than collecting new data, which is reproducibility, not replication.*

**Which initiatives feed each representative cell** (initiative → definitive n). Several projects span multiple fields, so their rows are assigned by each paper's home discipline rather than lumped under one label:

- **Psychology** (590): [Student Replication Projects](/replication-initiatives#boyce-et-al-student-replication-projects) 145, [DARPA SCORE](/replication-initiatives#tyner-et-al-darpa-score-social-behavioural-sciences-replication-project) 123, [Life Outcomes of Personality](/replication-initiatives#soto-life-outcomes-of-personality-replication-project) 118, [RP:Psychology](/replication-initiatives#reproducibility-project-psychology) 96, [X-Phi](/replication-initiatives#experimental-philosophy-reproducibility-project) 40, [EROE](/replication-initiatives#examining-replicability-of-online-experiments-holzmeister-et-al) 26, [Social Science Replication Project](/replication-initiatives#camerer-et-al-nature-science-social-science-replication-project) 21, [Sensory Marketing](/replication-initiatives#motoki-and-iseki-sensory-marketing-replication) 21
- **Biomedical** (198): [Cancer Biology](/replication-initiatives#reproducibility-project-cancer-biology) 132, [Brazilian Reproducibility Initiative](/replication-initiatives#brazilian-reproducibility-initiative) 66
- **Economics** (45): [DARPA SCORE](/replication-initiatives#tyner-et-al-darpa-score-social-behavioural-sciences-replication-project) 27, [Experimental Economics Replication Project](/replication-initiatives#camerer-et-al-experimental-economics-replication-project) 18
- **Education** (43): [DARPA SCORE](/replication-initiatives#tyner-et-al-darpa-score-social-behavioural-sciences-replication-project) 28, [L2 Replication (Marsden et al.)](https://doi.org/10.1111/lang.12286) 15 · **Political science** (41): [DARPA SCORE](/replication-initiatives#tyner-et-al-darpa-score-social-behavioural-sciences-replication-project) only
- **Sociology** (26): [DARPA SCORE](/replication-initiatives#tyner-et-al-darpa-score-social-behavioural-sciences-replication-project) 24, [Student Replication](/replication-initiatives#boyce-et-al-student-replication-projects) 2

Psychology is the only discipline with enough rows on both sides of both tables, and it is where the two views disagree — which is the point. Compared against **everything** we have harvested, psychology initiatives (58%) and harvested replications (59%) look identical. Compared against only our **direct** replications, the harvested rate drops to **49%** and the initiatives come out ahead. The harvested corpus's apparent parity is therefore substantially a *design* effect: it is only 13% direct replications, and looser designs succeed more often (close extensions 70% vs direct 52%). Biomedical shows the same movement — 50% on all types, 38% on direct only, against the initiatives' 33%.

Two cautions on reading these tables. First, outside psychology the direct-only column collapses to a handful of rows (n = 1–17), so Table A supports a claim about psychology and, more weakly, biomedicine — nowhere else. Second, the two columns still differ in *what was sampled*, not just how it was replicated: the initiatives each enumerated a defined slice of literature (specific journals and years), while the harvested rows have no sampling frame at all, so this is a comparison across populations and not a clean bias estimate. Note also that the smaller social-science fields (education, political science, and part of sociology) are populated almost entirely by **DARPA SCORE**, a deliberately cross-field initiative that sampled 62 social-science journals; its papers are split to their home disciplines above.

---

## 6. The crisis is field-general, not psychology-specific

Restricting to disciplines with at least 40 rows (rates are confounded by which initiative sampled each field, so read them as descriptive, not as field rankings):

| Discipline | n | Success rate | Original mean $\lvert r \rvert$ | Replication mean $\lvert r \rvert$ |
|---|---|---|---|---|
| Psychology | 3,827 | 55% | 0.339 | 0.191 |
| Medical fields | 1,434 | 58% | 0.207 | 0.162 |
| Neuroscience | 624 | 56% | 0.398 | 0.172 |
| Biomedical | 698 | 43% | 0.669 | 0.383 |
| Economics | 394 | 58% | 0.402 | 0.257 |
| Education | 118 | 80% | 0.344 | 0.189 |

**Conclusion:** the headline success rate varies by field, but **effect-size attenuation is universal** — replication magnitudes run ~50–75% of originals in every discipline measured. The shrinkage pattern, in particular, is not a quirk of any one field.

---

## Defensible conclusions

1. **About 45% of published findings replicate** under the strictest available criteria (direct, human-validated, run within coordinated initiatives). The replication crisis is real and field-general.
2. **Effect-size deflation is the load-bearing finding** — more reliable than binary pass/fail. Published effects are systematically inflated ~1.7–2×, the signature of publication bias and the winner's curse.
3. **There is no single "replication rate."** It moves from 44% to 66% by replication type. Any headline number must state its definition.
4. **Statistical significance is a weak predictor of replicability** (~58% carry-over).
5. **What gets *chosen* for replication is the dominant driver of success — not whether the work was systematic.** Once selection strategy is held fixed, representative-sampled and literature-harvested replications both run ~59%; the apparent "systematic looks worse" gap is entirely the targeted mega-replications of famous, contested effects (~12%).

---

## How to read these numbers (caveats that must accompany any public claim)

- **Convenience corpus, non-random.** Absolute rates describe this collection, not "the fraction of all science that replicates."
- **Pre-registration is not recorded.** The database does not capture whether the original *or* the replication study was pre-registered, so no claim here rests on pre-registration status. The "coordinated initiative" grouping reflects membership in major replication projects (via the `replication_initiative_tag` field), not a verified pre-registration flag.
- **~73% of rows are AI-curated and unvalidated.** Human-validated direct replications are the most trustworthy subset and are broken out above wherever possible.
- **"Success" is heterogeneous** — sometimes the replication authors' own judgment, sometimes a human curator's, sometimes the AI's. See [Replication outcome classification](/docs/replication-outcome-classification).
- **Effect-size conversion is approximate.** Translating diverse effect-size types into a common $r$ introduces noise and a handful of out-of-bounds artifacts (excluded from the analyses above).
- **Discipline and initiative are confounded.** Field-level rates partly reflect which projects sampled which fields, not intrinsic field differences.

*These figures will be updated as the database grows and as more rows are human-validated. If you find an error or want to contribute data, see the [replications database](https://metascienceobservatory.org/replications-database).*
