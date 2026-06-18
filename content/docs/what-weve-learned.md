# What we've learned so far


(NOTE: THIS PAGE IS AI GENERATED!! )


*A metascience-level read of the aggregate [replications database](https://metascienceobservatory.org/replications-database). Figures below are computed from database version `2026_05_17` (**7,524 replication pairs**) and will be refreshed as the database grows.*

> **How to read these numbers first.** This database is a **convenience corpus** assembled from systematic replication initiatives plus AI-assisted harvesting of the published literature — it is **not a random sample of science**. The rates below describe *this collection*, not "the fraction of all published science that replicates." About **73%** of rows are AI-curated and not yet human-validated, and the meaning of "success" varies by source (original judgment by replication authors, by a human curator, or by the AI). Treat every headline number as conditional on these caveats, which are spelled out at the bottom.

With that framing, several findings are robust enough to state plainly.

---

## 1. Roughly 45% of published findings replicate — and the number sharpens as the method tightens

Across all 7,524 rows, the raw outcome split is **success 46.4% · failure 35.8% · inconclusive 14.2% · reversal 1.8%**. Counting only definitive outcomes (excluding inconclusive), success / (success + failure) = **56.5%**.

But that loose figure is inflated by lenient replication designs. As you restrict to the most rigorous subset, the rate converges on a lower, more credible value:

| Subset | n | Success / (success + failure) |
|---|---|---|
| All definitive rows | 6,179 | 56.5% |
| Major coordinated replication initiatives | 1,506 | **46%** |
| Direct replications only | 2,047 | **44%** |
| Direct **and** human-validated ("gold standard") | 1,859 | **45%** |

**Conclusion:** when judged by the cleanest available evidence — direct, human-validated replications from coordinated initiatives — **a little under half of published effects replicate**. This holds across fields, not just psychology.

---

## 2. The most reliable signal is shrinkage, not pass/fail

Binary "did it replicate?" labels hide a more consistent and quantitative result: **published effect sizes systematically shrink on replication.** Among 1,773 study pairs with effect sizes converted to a common Pearson $r$ scale (see [Effect size normalization](/docs/effect-size-normalization)):

| Statistic | Original | Replication |
|---|---|---|
| Mean $\lvert r \rvert$ | 0.350 | **0.204** |
| Median $\lvert r \rvert$ | 0.317 | **0.129** |

- Replications retain only **~58% of the original magnitude** on average (median: ~41%).
- **~80%** of replications produce a *smaller* effect than the original.
- **~49%** come in below **half** the original effect.
- **~26%** collapse to essentially zero ($\lvert r \rvert < 0.05$).
- **~20%** flip sign relative to the original.

**Conclusion:** this is the textbook **winner's-curse / publication-bias signature**. Published effects are inflated by roughly **1.7–2×**. Because shrinkage is continuous and direction-consistent, it is a more reliable summary of the replication problem than any single pass/fail rate.

---

## 3. Statistical significance poorly predicts replicability

Among studies where both the original and replication report a p-value (n = 953 with an originally significant result), only **57.5%** of originally significant findings ($p < 0.05$) remain significant on replication.

**Conclusion:** an original "$p < 0.05$" carries only modest information about whether an effect is real. Significance is a weak instrument; effect size and its confidence interval are more informative.

---

## 4. "Replication rate" is not one number — it depends on the definition

The headline rate is highly sensitive to **how** a replication was conducted. Direct redos fail far more often than looser conceptual extensions:

| Replication type | n | Success rate |
|---|---|---|
| `direct` | 2,047 | **44%** |
| `direct or close` | 1,423 | 54% |
| `conceptual` | 379 | 52% |
| `close experiment` | 1,303 | 62% |
| `close extension` | 2,372 | **66%** |

**Conclusion:** apparent "success" climbs from 44% to 66% purely by loosening what counts as a replication. Any reported replication rate is meaningless without stating the design. See [Defining replication](/docs/defining-replication).

---

## 5. What gets *chosen* for replication matters more than systematic vs. ad-hoc

It is tempting to split this corpus into "coordinated replication initiatives" vs. "ad-hoc replications harvested from the literature" and compare success rates. Done crudely — every row belonging to a coordinated initiative on one side (1,506 rows, **46%**), every loose literature-harvested row on the other (6,018 rows, **59%**) — it looks like the ad-hoc literature is **13 points rosier**, as if published replications skew positive.

**That comparison is misleading, and the real signal is more interesting.** The "initiatives" bucket secretly mixes two opposite *selection strategies*, and pulling them apart dissolves the gap:

| Selection strategy | n (definitive) | Success rate |
|---|---|---|
| **Representative / systematically-sampled** initiatives (RP:P, DARPA SCORE, LOOPR, X-Phi, Cancer Biology, Brazilian Reproducibility Initiative, …) | 896 | **59%** |
| **Targeted mega-replications of famous / contested findings** (Many Labs, Registered Replication Reports) | 343 | **12%** |
| Ad-hoc / literature-harvested replications | 4,940 | **59%** |

**Conclusion:** once you separate *how the target was chosen*, **representative-sampled replications (59%) and literature-harvested ones (59%) are indistinguishable.** The whole "coordinated initiatives look worse" effect was driven by the targeted mega-replications, which deliberately go after a handful of celebrated, hotly-contested effects — and find that **only ~12% hold up** (Many Labs 3 **6%**, Many Labs 4 **6%**, Many Labs 5 **10%**, Registered Replication Reports **12%**), versus broad-sampling projects that score high (Life Outcomes of Personality Replication Project **87%**, Experimental Philosophy Reproducibility Project **78%**, DARPA SCORE **68%**).

The load-bearing variable is **what gets picked for replication**, not whether the replication was part of an organized initiative. Hand-picking a famous, surprising claim — exactly the kind of selection that *also* drives which findings get harvested from the literature — is one of the strongest predictors of failure in the whole database. (Caveat: the literature-harvested 59% is the least-validated number in this corpus — ~73% AI-curated with heterogeneous "success" definitions — so read its parity with the representative initiatives as suggestive, not settled.)

### The same pattern holds *within* disciplines

Breaking representative-sampled and literature-harvested replications down by field (restricted to cells with enough rows to be worth reading) shows this is not an artifact of psychology dominating the corpus. Where a discipline has both, the two run broadly comparable:

| Discipline | Representative-sampled initiatives | Literature-harvested |
|---|---|---|
| Psychology | **67%** (n=465) | **59%** (n=2,206) |
| Medical fields | 41% (n=27) | 59% (n=1,146) |
| Neuroscience | 80% (n=44) | 59% (n=664) |
| Biology | 33% (n=217) | 50% (n=344) |
| Economics | 70% (n=23) | 63% (n=264) |
| Education | 79% (n=24) | 86% (n=73) |

*Cells show definitive-outcome success rate (success / (success + failure)); n is the definitive-row count. Small-n cells like the medical and economics representative samples should be read with caution.*

The clearest test is psychology, where both buckets are well-populated: **random-sampled psychology initiatives replicate *better* (67%) than one-off psychology replications harvested from the literature (59%)** — the opposite of the "systematic looks worse" story (the deliberately-targeted contested findings, covered in section 5 above, sit far lower at **12%**). Biology shows representative samples replicating *below* the literature (33% vs 50%), a reminder that "representative" still means "whatever effects that particular initiative chose to sample," and field-specific selection cuts both ways.

---

## 6. The crisis is field-general, not psychology-specific

Restricting to disciplines with at least 40 rows (rates are confounded by which initiative sampled each field, so read them as descriptive, not as field rankings):

| Discipline | n | Success rate | Original mean $\lvert r \rvert$ | Replication mean $\lvert r \rvert$ |
|---|---|---|---|---|
| Psychology | 3,602 | 55% | 0.339 | 0.191 |
| Medical fields | 1,449 | 58% | 0.257 | 0.187 |
| Neuroscience | 827 | 60% | 0.419 | 0.229 |
| Biology | 694 | 43% | 0.674 | 0.385 |
| Economics | 373 | 63% | 0.373 | 0.236 |
| Education | 118 | 85% | 0.344 | 0.189 |

**Conclusion:** the headline success rate varies by field, but **effect-size attenuation is universal** — replication magnitudes run ~50–73% of originals in every discipline measured. The shrinkage pattern, in particular, is not a quirk of any one field.

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
