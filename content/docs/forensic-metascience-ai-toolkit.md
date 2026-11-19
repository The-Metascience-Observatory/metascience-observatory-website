# The Forensic Metascience AI toolkit

## Overview

The forensic metascience AI toolkit can be thought of as a set of different wrappers for AI agents. The system is modular and allows for different workflows to be run that combine modules in different ways. 

The system can be used with AI subscriptions to save money -- Codex, Claude Code, Grok Build, and Antigravity are all supported. 

[Much of it is open-source and on Github](https://github.com/The-Metascience-Observatory/forensic-metascience-ai-toolkit). To request access to the closed-source components, [send us an email](mailto:info@metascienceobservatory.org). 

<!-- HOW_IT_WORKS -->

<span id="where-this-agent-fits-in-the-ai-for-research-integrity-landscape"></span>

## Where this toolkit fits in the AI for research integrity landscape

Using AI to check papers is not a new idea, and many startups are already selling "AI for peer review" services. However, auditing the text and images of a single paper using commercial services currently costs \$50 or more. When used with subscription services like Claude Code on the backend, this toolkit's full pipeline costs only \$0.50 - \$1.00 per paper. We are also in the process of validating our tools agent to quantify how well it applies tools, something that commercial services have not yet done. We hope to show that are system has significant advantages over commercial competitors. 

<!-- TOOL_LOGOS -->

<!-- TOOLKIT -->

Each check applies only in a very specific set of circumstances. The GRIM tool is a simple example: if N integers in a bounded range (e.g. a 0-10 rating scale) are averaged, then only a finite set of valid averages is possible. The GRIM test checks if the reported average is in that set. We also have a couple of different tools for recalculating p-values. The SPRITE test infers possible underlying data distributions for integer data based on the allowed range, N, mean, and standard deviation. Distributions with many values at the extremes may be implausible.

<div class="my-6 border border-black px-4 pt-4">

**Example**. The paper by [Ladurner et al.](https://doi.org/10.1007/s00702-004-0248-2), *Journal of Neural Transmission* 112: 415–428, describes a multicentre randomised placebo-controlled trial of Cerebrolysin in acute stroke. The paper reports that "16.4% of the 78 patients" in the treatment group had an adverse event. But no whole number of patients out of 78 comes to 16.4%: 12/78 = 15.4%, and 13/78 = 16.7%. However, 11/67 = 16.42%. It appears the rate was computed on the 67 completers rather than all 78 randomised patients, despite the paper's claim that side effect rates were calculated on everyone, including non-completers. This means the side effect rate is unreliable and that the true side effect rate is likely higher.

</div>

Before running any checks, the AI is forced to classify each number by type, how it was derived, and how it is used. We found that enforcing this sort of framework was important for ensuring that the LLM applies tools appropriately and checks every single checkable number reported in a paper.

To assist with human review, we have developed a “rapid review” web application. The left-hand side of the application contains a list of findings, while the right-hand side displays the PDF. Our AI system ranks every finding on a [severity ladder](/forensic-metascience-ai-toolkit/severity-ladder) which helps with triage.  Clicking on each finding jumps the PDF to the relevant section with relevant text and numbers highlighted. Image duplication and manipulation findings are displayed via diagrams and/or videos.

To give you an idea of how thorough our system is, it consumes 1-6 million tokens and takes 25-40 minutes to run per paper. The full system costs \$0.50 - \$1.00 per paper to run depending on the length of the paper and the AI subscription service used. The image analysis module and copy-paste detection module are very cheap to run (pennies per paper) and can be run in isolation.

## Applications

### I. Correcting the scientific record

Scientific papers are used to inform grant funding, government policy, and medical practice (e.g., via [UpToDate](https://en.wikipedia.org/wiki/UpToDate), [OpenEvidence](https://en.wikipedia.org/wiki/OpenEvidence), [Cochrane Library](https://en.wikipedia.org/wiki/Cochrane_Library)). They increasingly inform people’s personal healthcare decisions, as patients turn to Google Scholar and AI research assistants to augment their medical decisions. Given the role of this research in decision-making, we are particularly  interested in errors that substantially change a key finding, as well as data integrity issues that undermine the paper's validity. When we find major errors, we request that journals address them through retractions or errata. We submit findings on [PubPeer](https://pubpeer.com/) and publicize them on our website and social media channels. A running list of what the toolkit has found — including the comments we have posted on PubPeer — is on the [Findings & PubPeer comments](/forensic-metascience-ai-toolkit/findings) page.

### II. As a tool for pre-publication review

Once it has been validated further, we plan to open-source our codebase so anyone can run the toolkit and open-source software developers can contribute pull requests with potential improvements.

We think it is a bit ridiculous that many researchers are currently paying to use AI peer review services like [reviewer3](https://reviewer3.com/) (\$19 per review) and [refine.ink](https://refine.ink/) (\$30-50 per review). As far as we can tell, the current paid services have not been externally validated to any significant degree.

A [recent analysis](https://www.paullitvak.com/p/how-well-does-ai-peer-review-work) by Paul Litvak tested two popular commercial tools against base LLMs on 10 psychology papers where he had inserted 100 errors. Only about 20% of his errors were stats/math issues that our system is particularly suited for; the bulk of the rest were issues in experimental design. He found that *reviewer3* performed worst, finding only 30/100 errors, below Gemini Flash. Refine.ink found 57/100, worse than GPT 5.5 with high reasoning, which found 77/100. Litvak notes that *refine.ink* cost him \$8.77 per error found. Interestingly, when Litvak ensembled the outputs from five systems, the overall recall jumped to 90%. We recently ran our system on the benchmark with Opus 5 and it found 49/100. We are in the process of digging deeper into how our system performed.

### III. Metascientific research

The tools agent can be used in isolation to systematically research the prevalence of different error types within and across scientific fields. When James Heathers [did GRIM test checks](https://journals.sagepub.com/doi/10.1177/1948550616673876) on papers in leading psychology journals, 36 out of 71 papers with testable numbers had at least one discrepancy (51%). [Previous work](https://link.springer.com/article/10.3758/s13428-015-0664-2) in 2016 with the statcheck tool found that about half of psychology papers had an issue with a p-value calculation, while 12.5% had an error that actually reversed a significant conclusion. The tools agent or simplified lower-cost versions can be used to study the prevalence of errors across many different fields.

