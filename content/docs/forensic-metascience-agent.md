# The Forensic Metascience Agent

<!-- FINDINGS_CTA -->

The Forensic Metascience Agent is an AI agent equipped with 30+ tools for "sanity checking" the statistics and data presented in scientific papers. Much of it is based directly off of James Heathers' book [*An Introduction to Forensic Metascience*](https://doi.org/10.5281/zenodo.14871843).


Reported statistics are internally redundant: a mean of integer-scaled responses can only take certain values for a given sample size; a standard deviation is bounded by the range of the measurement; a t-statistic, its degrees of freedom, and its p-value must agree with one another; two "independent" studies should not report identical means and standard deviations down to the second decimal place. When the reported numbers violate these constraints, something is wrong — a typo, a copy-paste slip, a miscalculation, or worse.

<!-- INTRO_END -->

## The fraud problem

<!-- FRAUD_STATS -->

## The rigor problem

<!-- ERROR_STATS -->


**Checking works.** When two psychology journals began running statcheck during peer review, the share of articles with statistical reporting inconsistencies roughly halved — from about 40% to about 20% — while matched control journals barely moved ([Nuijten & Wicherts 2024](https://doi.org/10.1177/25152459241258945)). Automated checking demonstrably works, and almost nobody does it.


## The slop problem

<!-- SLOP_STATS -->

None of this needs to be fraud in the classic sense. Open datasets like NHANES and UK Biobank are legitimate, valuable resources; the problem is the industrialized workflow: pick one exposure and one outcome, run a regression, skip the multiple-testing correction, and let a language model write the manuscript. Each paper looks plausible on its own — one journal editor described receiving ["one a day, sometimes even two a day"](https://www.nature.com/articles/d41586-025-02241-2) — and some publishers have begun [cracking down on open-dataset submissions entirely](https://www.science.org/content/article/journals-and-publishers-crack-down-research-open-health-data-sets).

The fingerprints of language models are all over the surge. By late 2024, an estimated [22.5% of computer-science abstracts showed signs of LLM writing](https://doi.org/10.1038/s41562-025-02273-8); published papers have been caught containing leftovers like "regenerate response" and "as an AI language model, I cannot…"; and nonsense phrases such as ["vegetative electron microscopy" — a "digital fossil" born from a scanning error in AI training data](https://theconversation.com/a-weird-phrase-is-plaguing-scientific-papers-and-we-traced-it-back-to-a-glitch-in-ai-training-data-254463) — now propagate through the literature. Meanwhile the number of papers published per year grew [~47% between 2016 and 2022, far outpacing the growth in the number of scientists](https://doi.org/10.1162/qss_a_00327), and the PNAS analysis above finds that corrective measures — retractions, PubPeer flags — are doubling less than half as fast as paper-mill output. The correction system is being outrun.


## The oversight problem


Detection capacity is shrinking as the problem grows. The Office of Research Integrity's output has collapsed — 2025 produced the fewest misconduct findings in its 32 years of record — and [NSF's Office of Inspector General stopped investigating research misconduct in early 2025](https://www.science.org/content/article/exclusive-nsf-watchdog-unit-no-longer-investigating-research-misconduct), referring all allegations back to the grantee institutions.

<!-- ORI_CHART -->

Nor can peer review be counted on to catch problems: in four independent studies in biomedicine that deliberately inserted errors into manuscripts, peer reviewers caught only 25–35% of them (e.g., [Schroter et al. 2008](https://doi.org/10.1258/jrsm.2008.080062)). The checking has to come from somewhere else.


## Where this agent fits in AI for research integrity landscape

<!-- TOOL_LOGOS -->

<!-- TOOLKIT -->

## The agent in action: a worked example

A small arithmetical anomaly can have big consequences. Here is a finding from a live run on a real, non-retracted paper: [Ladurner et al.](https://doi.org/10.1007/s00702-004-0248-2), *Journal of Neural Transmission* 112: 415–428 — a multicentre randomised placebo-controlled trial of Cerebrolysin in acute stroke.

The paper reports that **16.4% of the 78 patients** in the treatment group had an adverse event. But no whole number of patients out of 78 comes to 16.4%: 12 gives 15.4%, and 13 gives 16.7%. The two other safety rates in the same paragraph *do* work out at 78, so the three cannot all be shares of the same group. (Every placebo figure, meanwhile, pins exactly to 68.)

The likely innocent explanation — which we name ourselves — is that the rate was computed on the 67 completers rather than all 78 randomised patients: 11 of 67 is 16.42%. But the innocent explanation is still a problem. If so, the drug and placebo safety rates being compared are not on the same footing. More alarmingly, the 11 patients missing from the denominator are exactly the ones most likely to have been harmed — so the adverse event rate is likely under-reported.


## What should be reported, and how? 

At some point we might report every mathematical impossibility and statistical error we find on PubPeer. However, most errors are simple mistakes, and many are utterly inconsequential. The spectre of false positives is also very real when it comes to using AI, which is not 100% accurate at applying these tools (it may, for instance, apply GRIM on data that is actually continuous, not discrete). So, every finding found by the AI undergoes human review and scrutiny. Right now, it takes a lot for something to rise to the level of "we should report this on PubPeer / widely publicize this".

A running list of what the agent has found — including the comments we have posted on PubPeer — is on the **[Findings & PubPeer comments](/forensic-metascience-agent/findings)** page.
