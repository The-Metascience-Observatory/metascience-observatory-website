# The Forensic Metascience Agent

<!-- FINDINGS_CTA -->

The Forensic Metascience Agent is an AI agent equipped with 40+ tools for "sanity checking" the statistics and data presented in scientific papers. Many of these tools are dervived from techniques described in James Heathers' book [*An Introduction to Forensic Metascience*](https://doi.org/10.5281/zenodo.14871843).


Reported statistics are internally redundant: a mean of integer-scaled responses can only take certain values for a given sample size; a standard deviation is bounded by the range of the measurement; a t-statistic, its degrees of freedom, and its p-value must agree with one another; two "independent" studies should not report identical means and standard deviations down to the second decimal place. When the reported numbers violate these constraints, something is wrong — a typo, a copy-paste slip, a miscalculation, or worse.

<!-- INTRO_END -->

## The fraud problem

<!-- FRAUD_STATS -->

## The rigor problem

<!-- ERROR_STATS -->


## The slop problem

<!-- NHANES_CHARTS -->


## The oversight problem


Detection capacity is shrinking as the problem grows. The Office of Research Integrity's output has collapsed — 2025 produced the fewest misconduct findings in its 32 years of record — and [NSF's Office of Inspector General stopped investigating research misconduct in early 2025](https://www.science.org/content/article/exclusive-nsf-watchdog-unit-no-longer-investigating-research-misconduct), referring all allegations back to the grantee institutions.

<!-- ORI_CHART -->

Nor can peer review be counted on to catch problems: in four independent studies in biomedicine that deliberately inserted errors into manuscripts, peer reviewers caught only 25–35% of them (e.g., [Schroter et al. 2008](https://doi.org/10.1258/jrsm.2008.080062)).


## Where this agent fits in AI for research integrity landscape

<!-- TOOL_LOGOS -->

<!-- TOOLKIT -->

## Theory of impact

Systems like the forensic metascience agent can be used for both pre-publication review and post-publication review. Currently (as of August 2026), the system costs on average \$0.61 per paper when using Sonnet and \$1.45 when using Opus 4.6 (range ~\$0.70–\$3.00), running through the Claude Code CLI on a Claude Code 20x subscription. These costs are roughly 10x higher when using the API. Soon we will be testing other models and different changes to our pipeline that may reduce cost while maintaining accuracy and coverage. In contrast to other approaches, our system is meant to be very systematic, checking every number in a publication and supplementary information. 


### For pre-publication review

Our forensic metascience agent may also be used by researchers to audit their work before submitting to a journal. Journals could also use it to augment the traditional peer review process. When two psychology journals began running <i>statcheck</i> during peer review, the share of articles with statistical reporting inconsistencies roughly halved — from about 40% to about 20% ([Nuijten & Wicherts, 2024](https://doi.org/10.1177/25152459241258945)). 

### For post-publication review

Given limited budget and human reviewer time, we have to be selective regarding which papers we run on. We focus mainly on clinical trials since 1. they are especially important for human wellbeing and 2. they contain a lot of data and statistics. We are collaborating with [Intellicat](https://intellicat.ai) to see if their systems can assist in screening. We are in the process of implementing a cheaper AI model that screens for specific types of known issues in clinical trials which are often the 

A small arithmetical anomaly can have big consequences. For instance, in [Ladurner et al.](https://doi.org/10.1007/s00702-004-0248-2), *Journal of Neural Transmission* 112: 415–428 — a multicentre randomised placebo-controlled trial of Cerebrolysin in acute stroke. The paper reports that "16.4% of the 78 patients" in the treatment group had an adverse event. But no whole number of patients out of 78 comes to 16.4%: 12/78 = 15.4%, and 13/78 = 16.7%. However 11/67 = 16.42%. It appears the rate was computed on the 67 completers rather than all 78 randomised patients, despite the paper's claim that side effect rates were calculated on everyone, including non-completers. 


## What should be reported, and how? 

Ideally there would be a central location where errors could be recorded and surfaced. Imagine if every PDF had a pane that surfaced validated mistakes and issues.  

Currently, we have to make tough judgement calls regarding when to report errors to PubPeer and when to email an editor to push for an erratum or retraction. 

A running list of what the agent has found — including the comments we have posted on PubPeer — is on the **[Findings & PubPeer comments](/forensic-metascience-agent/findings)** page.
