# Core Extraction Pipeline Evaluation

October 2026

> **Provisional.** These results are preliminary. The 60-paper reference set was coded by an AI adjudicator and is still being audited by a person; the figures will be updated with the audit's error rate. The [February 2026 V6 evaluation](https://github.com/The-Metascience-Observatory/metascience-observatory-website/blob/main/content/docs/v6_pipeline_evaluation.md) remains available for reference.

The Metascience Observatory's newest extraction pipeline, the "core" pipeline, reads a replication paper and records what was replicated: which original study, which finding, what kind of replication it was (direct, close, or conceptual) and whether it succeeded. It does not extract statistics. It makes a single model call per paper (Claude Sonnet 5.5) and costs about $0.13 and 15 seconds per paper.

We evaluated it in two ways:

1. **Against human labels of the original study**, on 458 replication papers whose originals were recorded by people: the FLoRa and FReD replication databases and our own earlier hand-coded rows.
2. **Against a reference set of 60 papers coded effect by effect**, chosen to span 13 disciplines and to include papers that are *not* replications.

**Read these numbers with one caveat in mind.** The 60-paper reference was coded by an AI adjudicator (Claude Opus 5.5), not by people. A human audit of 15 of those papers is under way, and its error rate will be reported here. Until then, treat the effect-level figures as provisional. The original-study figures in the first section rest on human labels.

## Identifying the original study

We consider naming the wrong original study the most serious error a replication database can make, so we measured it first and on the largest set. For each paper, we checked whether the pipeline named at least one of the original studies people had recorded for it.

| | Papers | Original study correctly identified |
|---|---|---|
| Raw agreement with human labels | 458 | 80.8% (77.1–84.3%) |
| After resolving disagreements (see below) | 458 | **90.4% (87.6–93.2%)** |
| Counting the right study with a non-matching DOI | 458 | 96.3% |

Ranges are 95% confidence intervals.

Raw agreement understates accuracy, because the human labels are not always right. FLoRa, for example, records a single original per paper, and sometimes that is the dataset, the measurement scale or a correction notice rather than the finding that was replicated. For the 47 papers where the pipeline and the human label named different studies, an AI adjudicator read the paper and judged each candidate. It was not told which candidate came from the pipeline and which from the label. It found:

- the pipeline right and the label wrong in 36 papers;
- both right in 9 papers (often the same work under a different identifier);
- the label right and the pipeline wrong in 2 papers.

Of the remaining misses, 14 are papers where the pipeline found no replication at all. Another 27 name the correct study but attach a DOI that does not match the label's.

During this evaluation we found and fixed one source of error. The pipeline sometimes wrote down a DOI belonging to a different paper. Its own check noticed the mismatch, but it kept the DOI anyway. It now discards such a DOI and looks the study up by title. On the same model output this fix alone raised raw agreement from 76.6% to 80.8%.

## The 60-paper reference set

We selected 60 papers from a larger development set, stratified by how they were originally found. The set includes replications labelled as successes, failures, inconclusive results and reversals, and papers that deliberately are not replications. We down-weighted psychology so that other fields are represented:

| Discipline | Papers |
|---|---|
| Psychology | 18 |
| Economics | 11 |
| Biology | 9 |
| Neuroscience | 7 |
| Medical fields | 6 |
| Linguistics | 2 |
| Sports science, HCI, political science, environmental science, education, sociology, business | 1 each |

The adjudicator first read each paper with no other input and listed every replicated finding. Only then did it see the proposals of two other AI coders, and it had to accept or reject each one with a reason. It never saw the pipeline's output. The result was 41 papers containing replications (207 replicated findings), 17 papers without, and 2 that could not be scored. One of those two is a study that never names its originals in the text; for the other, only the supplement was on file.

A separate model (Claude Sonnet) paired each pipeline entry with a reference entry. A shared original-study DOI is not enough to pair two entries, because one original paper often contains several findings.

## Key results

| Measure | Result |
|---|---|
| Papers with replications, detected | 41 of 41 (100%) |
| Replicated findings found (recall) | 69.6% (55.5–82.8%) |
| Pipeline entries that match a reference finding (precision) | 82.3% (71.6–90.3%) |
| Replication type, exact (direct / close experiment / close extension / conceptual) | 84.7% (71.5–93.5%) |
| Replication type, exact or one step off | 96.5% |
| Outcome, exact (success / failure / inconclusive / reversal) | 78.5% (55.7–96.6%) |

**Recall depends on how finely findings are split.** The adjudicator split findings by outcome measure, comparison group and subgroup. The pipeline usually wrote one entry per claim. Two papers account for most of the missed findings: one has 23 genetic-variant results that the pipeline grouped into 8 entries, and another has 12 outcome-by-arm results grouped into 3. Most "missed" findings are therefore grouped, not overlooked, and 69.6% should be read as a lower bound.

**Precision on papers that contain replications is 91.7%.** Most of the remaining false entries come from papers the adjudicator judged not to be replications (next section).

## Classifying the outcome

![Confusion Matrix](/docs/core_oct2026_confusion_matrix.png)

Rows are the reference, columns the pipeline. The pipeline never confused a success with a failure, and it caught all three reversals. Every outcome error is a move to or from "inconclusive". Most come from one sports-science paper whose 25 outcomes are reported only in tables printed as images. The pipeline reads text, so it found all 25 findings but could not see their outcomes and called each one inconclusive. **Without that paper, outcome accuracy is 93.3% (111 of 119).** Reading image tables is the clearest improvement for the next version.

This is the reverse of our February 2026 evaluation of the V6 pipeline, which committed to success or failure too readily. The core pipeline leans towards "inconclusive" when the evidence it can see is incomplete.

## What counts as a replication

The pipeline reported replications in 8 of the 17 papers the adjudicator judged not to be replications. Six of those 8 are economics papers that re-analyse the original study's own data with new methods. Our coding rules count such reanalyses as not replications; the pipeline's instructions do not mention them. This is a question of definition more than an extraction error, and we are deciding which way the database should go. If reanalyses are excluded from scoring, precision rises from 82.3% to 90.0%. The rate of reporting a replication in a paper that has none falls from 47% to 18%.

## Limitations

- **The 60-paper reference is AI-adjudicated.** It was coded by Claude Opus 5.5 and is being audited by a person. The pipeline, the matcher and the adjudicator are all Claude models, from different model sizes and run independently; the adjudicator never saw the pipeline's output.
- **Small numbers.** With 41 papers that contain replications, the confidence intervals are wide. Disciplines with a single paper support only the overall figures, not per-field claims.
- **Not a fresh holdout.** The 60 papers were drawn from a set used during development, although never with this pipeline.
- **No statistics.** The core pipeline does not extract sample sizes, effect sizes or p-values, and they were not evaluated.

## Comparison with the V6 evaluation

The V6 figures (February 2026) are not directly comparable. That ground truth was partly produced with the help of the V6 pipeline itself, its matching leaned on original-study DOI equality, and it measured statistics, which the core pipeline does not extract. We have since rebuilt the evaluation so that the reference never draws on the system being scored.
