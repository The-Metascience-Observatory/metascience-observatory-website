# The Forensic Metascience Agent

<!-- FINDINGS_CTA -->

The "Forensic Metascience Agent" is actually an orchestration system that orchestrates several AI agents to perform a deep forensic audit of a scientific paper. The full system checks images, text, and data in both the paper and supplementary files. Central to the system is the tools agent, which is equipped with 40+ tools for "sanity checking" the statistics and data presented in scientific papers. Many of the tools are derived from techniques described in James Heathers' book [*An Introduction to Forensic Metascience*](https://doi.org/10.5281/zenodo.14871843). 


<!-- INTRO_END -->

## The data integrity problem

<!-- FRAUD_STATS -->

## The rigor problem

<!-- ERROR_STATS -->


## The slop problem

<!-- NHANES_CHARTS -->


## The oversight problem
The number of scientific papers being published each year is growing exponentially with a doubling time of [approximately 10 years](https://www.crossref.org/blog/2026-public-data-file-now-available/#:~:text=12.7%20million%20new%20records%20(a%207.6%25%20increase%20since%20last%20year).). Meanwhile, the number of fake papermill papers being published has been estimated to be doubling [every 1.5 years](https://www.pnas.org/doi/10.1073/pnas.2420092122). AI tools make it easier than ever for fraudsters to commit research fraud. 

Meanwhile, our ability to detect fraud has been constant or decreasing. A handful of largely unpaid image sleuths appear to be responsible for most detections of image fraud thus far.  

The Office of Research Integrity's output has collapsed — 2025 produced the fewest misconduct findings in its 32 years of record — and [NSF's Office of Inspector General stopped investigating research misconduct in early 2025](https://www.science.org/content/article/exclusive-nsf-watchdog-unit-no-longer-investigating-research-misconduct), referring all allegations back to the grantee institutions.

<!-- ORI_CHART -->

Peer review is useful, but the peer review system is under increasing strain. Studies indicate that peer reviewers do a very incomplete job when it comes to catching serious errors. Across [four](https://doi.org/10.1001/jama.280.3.237) [independent](https://www.bmj.com/content/bmj/328/7441/673.full.pdf) [studies](https://journals.sagepub.com/doi/full/10.1258/jrsm.2008.080062) [in biomedicine](https://www.sciencedirect.com/science/article/abs/pii/S019606449870006X) where researchers deliberately inserted errors into manuscripts, peer reviewers only caught 25–35% of them.


## Where this agent fits in the AI for research integrity landscape

<!-- TOOL_LOGOS -->

<!-- TOOLKIT -->

## Overview

The FMA is a multi-agent pipeline that performs a detailed audit of a scientific paper, including the text, images, and data.

The FMA is a “harness” for AI. The backend can be a Codex, Claude Code, or Grok Build subscription, or API calls to any agentic AI system. The “tools agent” module equips the AI with 44 tools it can use to sanity check the statistics and data presented in scientific papers. Each tool is a Python script that performs a specific type of check. Many of the techniques implemented are taken from James Heathers' book [*An Introduction to Forensic Metascience*](https://doi.org/10.5281/zenodo.14871843).

Each check applies only in a very specific set of circumstances. The GRIM tool is a simple example: if N integers in a bounded range (e.g. a 0-10 rating scale) are averaged, then only a finite set of valid averages is possible. The GRIM test checks if the reported average is in that set. We also have a couple of different tools for recalculating p-values. The SPRITE test infers possible underlying data distributions for integer data based on the allowed range, N, mean, and standard deviation. Distributions with many values at the extremes may be implausible.

<div class="my-6 border border-black px-4 pt-4">

**Example**. The paper by [Ladurner et al.](https://doi.org/10.1007/s00702-004-0248-2), *Journal of Neural Transmission* 112: 415–428, describes a multicentre randomised placebo-controlled trial of Cerebrolysin in acute stroke. The paper reports that "16.4% of the 78 patients" in the treatment group had an adverse event. But no whole number of patients out of 78 comes to 16.4%: 12/78 = 15.4%, and 13/78 = 16.7%. However, 11/67 = 16.42%. It appears the rate was computed on the 67 completers rather than all 78 randomised patients, despite the paper's claim that side effect rates were calculated on everyone, including non-completers. This means the side effect rate is unreliable and that the true side effect rate is likely higher.

</div>

Before running any checks, the AI is forced to classify each number by type, how it was derived, and how it is used. We found that enforcing this sort of framework was important for ensuring that the LLM applies tools appropriately and checks every single checkable number reported in a paper.

To assist with human review, we have developed a “rapid review” web application. The left-hand side of the application contains a list of findings, while the right-hand side displays the PDF. Our AI system ranks every finding on a [severity ladder](/forensic-metascience-agent/severity-ladder) which helps with triage.  Clicking on each finding jumps the PDF to the relevant section with relevant text and numbers highlighted. Image duplication and manipulation findings are displayed via diagrams and/or videos.

To give you an idea of how thorough our system is, it consumes 1-6 million tokens and takes 25-40 minutes to run per paper. The full system costs \$0.50 - \$1.00 per paper to run depending on the length of the paper and the AI subscription service used. The image analysis module and copy-paste detection module are very cheap to run (pennies per paper) and can be run in isolation.

### Lessons from previous initiatives

We are not the first people to have the idea of using AI to find errors in the published scientific literature.

The first major initiative along these lines was The Black Spatula project, which [was launched](https://secondthoughts.ai/p/the-black-spatula-project) as a crowdsourced initiative by Steve Newman in December 2024. The goal was to run the best AI model at the time (o1 preview) on thousands of papers to catch important mistakes. Several hundred people joined the Black Spatula Discord and WhatsApp group, resulting in an initial burst of activity lasting a few weeks. The project eventually petered out after a year or so. We did an “autopsy” on the Black Spatula project to see if there was anything we could learn that would inform our own project. It appears the initiative petered out due to lack of central coordination, high rates of false positives, and lack of volunteers to perform the arduous work of reviewing all the AI outputs and deciding how to act on them.

Another initiative was YesNoError, which was also founded in December 2024. The project was funded by a Solana coin/token that reached a peak market cap of \$110 million. YesNoError evaluated 37,000+ papers in two months using o1, with a stated aspiration to audit 90 million. They then publicized the flagged papers, mostly without any human verification. In March 2025, science integrity expert Nick Brown [found a](https://www.nature.com/articles/d41586-025-00648-5#:~:text=.%20Among%2040%20papers,wrong%2C%20he%20says.) false positive rate of 35% in a small sample of 40 papers. Shortly after, all of the results of the run disappeared from the internet and the website pivoted to focusing solely on AI research papers.

### Experiments with “targeting funnels”

We are experimenting with different ways of doing screening/targeting to decide which papers to audit with the FMA. We have entered into an unpaid collaboration with [IntelliCat](https://intellicat.ai) to test if their system could be helpful. IntelliCat has generated “Content Credibility Index” (CCI) scores for millions of papers. For a much smaller number of papers, they have also generated Data and Observations Risk Index (DORI) scores based on “domain-specific models to assess experimental data and figures for signals of manipulation or fabrication”. Initial work with our replication database indicates that a bad DORI strongly increases the chances of replication failure by 8x, so we are particularly interested in using the DORI for targeting. We are also looking at doing screening using very cheap AI APIs on thousands of open-access papers that are available in XML format to find “canary in the coal mine” issues that may be indicative of more serious issues. Another approach to targeting we are exploring is running the agent on papers by authors who have retractions reported by Retraction Watch.

## Applications

### I. Correcting the scientific record

Scientific papers are used to inform grant funding, government policy, and medical practice (e.g., via [UpToDate](https://en.wikipedia.org/wiki/UpToDate), [OpenEvidence](https://en.wikipedia.org/wiki/OpenEvidence), [Cochrane Library](https://en.wikipedia.org/wiki/Cochrane_Library)). They increasingly inform people’s personal healthcare decisions, as patients turn to Google Scholar and AI research assistants to augment their medical decisions. Given the role of this research in decision-making, we are particularly  interested in errors that substantially change a key finding, as well as data integrity issues that undermine the paper's validity. When we find major errors, we request that journals address them through retractions or errata. We submit findings on [PubPeer](https://pubpeer.com/) and publicize them on our website and social media channels. A running list of what the agent has found — including the comments we have posted on PubPeer — is on the [Findings & PubPeer comments](/forensic-metascience-agent/findings) page.

### II. As a tool for pre-publication review

Once it has been validated further, we plan to open-source our codebase so anyone can run the FMA and open-source software developers can contribute pull requests with potential improvements.

We think it is a bit ridiculous that many researchers are currently paying to use AI peer review services like [reviewer3](https://reviewer3.com/) (\$11 per review) and [refine.ink](https://refine.ink/) (\$30-50 per review). As far as we can tell, the current paid services have not been externally validated to any significant degree.

A [recent analysis](https://www.paullitvak.com/p/how-well-does-ai-peer-review-work) by Paul Litvak tested two popular commercial tools against base LLMs on 10 psychology papers where he had inserted 100 errors. Only about 20% of his errors were stats/math issues that our system is particularly suited for; the bulk of the rest were issues in experimental design. He found that *reviewer3* performed worst, finding only 30/100 errors, below Gemini Flash. Refine.ink found 57/100, worse than GPT 5.5 with high reasoning, which found 77/100. Litvak notes that *refine.ink* cost him \$8.77 per error found. Interestingly, when Litvak ensembled the outputs from five systems, the overall recall jumped to 90%. We recently ran our system on the benchmark with Opus 5 and it found 49/100. We are in the process of digging deeper into how our system performed.

### III. Metascientific research

The tools agent can be used in isolation to systematically research the prevalence of different error types within and across scientific fields. When James Heathers [did GRIM test checks](https://journals.sagepub.com/doi/10.1177/1948550616673876) on papers in leading psychology journals, 36 out of 71 papers with testable numbers had at least one discrepancy (51%). [Previous work](https://link.springer.com/article/10.3758/s13428-015-0664-2) in 2016 with the statcheck tool found that about half of psychology papers had an issue with a p-value calculation, while 12.5% had an error that actually reversed a significant conclusion. The tools agent or simplified lower-cost versions can be used to study the prevalence of errors across many different fields.
