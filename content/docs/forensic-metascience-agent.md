# The Forensic Metascience Agent

The Forensic Metascience Agent is an AI agent we are developing that reads a scientific paper — the body text, the tables in the main PDF, and any supplementary-information PDFs — and checks every checkable statistic for internal consistency. It applies a battery of 31 statistical forensics tools, ranging from classic granularity tests like GRIM to randomized-trial baseline checks in the tradition of John Carlisle's anesthesiology audits, and then writes an editorial review that ends in a plain-language trust verdict: *trustworthy*, *questionable*, or *untrustworthy*.

## Why forensic metascience?

A surprising amount of error — and occasionally fabrication — can be detected from a published paper alone, without any access to the raw data. Reported statistics are internally redundant: a mean of integer-scaled responses can only take certain values for a given sample size; a standard deviation is bounded by the range of the measurement; a t-statistic, its degrees of freedom, and its p-value must agree with one another; two "independent" studies should not report identical means and standard deviations down to the second decimal place. When the reported numbers violate these constraints, something is wrong — a typo, a copy-paste slip, a miscalculation, or worse.

Checking these constraints by hand is tedious, error-prone work that a small community of specialists ("data thugs," as they've affectionately been called) has done for years. The methods themselves are well documented — our agent's toolkit implements the techniques catalogued in James Heathers' [*An Introduction to Forensic Metascience*](https://doi.org/10.5281/zenodo.14871843) (2025) — but applying them exhaustively to a paper takes hours of expert attention. This is exactly the kind of systematic, rule-governed work that AI agents are well suited to: sweep every statistic, run the right check on each one, and record the results in a form a human can verify.

## How it works

The agent runs a two-stage pipeline built on the Claude Agent SDK.

**Stage 1 — the forensic sweep.** An agent armed with all 31 forensic tools (exposed via an [MCP](https://modelcontextprotocol.io/) server) reads the paper and works through it statistic by statistic: means and SDs are checked for granularity and range violations, test statistics are recomputed from group summaries, thresholded p-values are recalculated exactly, baseline tables in randomized trials are tested for excessive similarity, and all tables are cross-compared for duplicated data. The output is a schema-validated JSON file of structured findings. Every finding records the technique used, the exact inputs read from the paper, the computed versus reported values, a severity rating, and a reproduction command — so any human can re-run the exact check from the command line and confirm it.

**Stage 2 — the editorial review.** A second pass triages the findings and adds the contextual reasoning a numeric sweep can't: Is the headline effect size plausible against external benchmarks? Does the statistical analysis match the study design? Does the paper claim its data are available while actually withholding them? It then writes a narrative report, leading with the most important problem and ending with the trust verdict.

Every finding carries one of five severity levels:

- **impossible** — violates mathematics (e.g., a GRIM failure, an SD above the maximum possible for the measurement range, an implied correlation greater than 1)
- **highly suspicious** — technically possible but extremely unlikely under honest reporting
- **suspicious** — unusual but plausible (e.g., a recalculated statistic disagreeing beyond rounding)
- **indeterminate** — cannot be determined from the available information
- **consistent** — passes the check

<!-- TOOLKIT -->

## Guardrails

A tool that scans papers for anomalies must be careful about false accusations, so the agent operates under an explicit rulebook that encodes hard-won lessons from the forensic metascience community:

- **Impossibility beats implausibility.** A single verified mathematical impossibility outranks any number of merely suspicious findings — but the inputs must be verified first. Misapplied GRIM (running it on continuous data like body weight) is the most common source of false accusations, and the agent is explicitly instructed against it.
- **No invented constraints.** A finding that depends on an assumed-but-unstated bound (say, a guessed plausible range for adult height) is capped in severity and can never be the headline problem of a review.
- **Language discipline.** Reports say "anomaly," "inconsistency," and "warrants clarification." Words like "fabrication" are reserved for verified impossibilities — and even then phrased as "consistent with" rather than as an accusation.
- **Reproducibility.** Every finding includes its exact inputs and a command-line reproduction string, so nothing rests on the agent's say-so.

The agent is a triage and second-opinion tool, not an accusation engine. Its job is to surface things that warrant a closer human look — and to make that closer look easy.

## Evaluation

We evaluate the pipeline against gold-standard fixtures hand-derived from in-depth reviews by expert human forensic reviewers. Automated scoring measures how many of the expert's key findings the agent recovered (weighted by importance), how many false positives it introduced, and whether its overall verdict agreed with the expert's. The statistical tools themselves are covered by a suite of roughly 190 unit tests. The agent does not yet match a careful human expert — in our evaluations it recovers many, but not all, of the findings an expert surfaces — and we treat every automated review as a draft for human verification rather than a final judgment.

## Get in touch

We are actively developing this project and are interested in collaborating with researchers, journals, and institutions who want to apply forensic screening at scale. If you'd like to learn more, [contact us](mailto:OBFUSCATED_EMAIL).
