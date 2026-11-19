# Scaling Forensic Metascience

<!-- FINDINGS_CTA -->

The [Metascience Observatory's](/) [research](https://moreisdifferent.blog/p/what-weve-learned-so-far-at-the-metascience) has demonstrated that the replication crisis is a science-wide phenomenon, not just limited to psychology and the social sciences. Across many fields, 40% or more of results are not replicating. 

Now, the Metascience Observatory is embarking on an ambitious research program to discover major issues in the scientific literature -- issues that greatly call into question the provenance and reliability of data and results. James Heathers [estimates](https://metaror.org/kotahi/articles/18/index.html) that about 14% of peer-reviewed papers have major issues. Whether the true number is 5% or 25%, it is high enough that some "cleanup" is needed. 


Research in [forensic metascience](https://jamesheathers.curve.space/) using tools like statcheck and the GRIM test shows that simple mistakes in data processing are common, with over half of papers in psychology having errors in the [calculation of p-values](https://pmc.ncbi.nlm.nih.gov/articles/PMC7540394/) or [averages](https://journals.sagepub.com/doi/10.1177/1948550616673876). Most errors are harmless, but some change key results, contaminating meta-analyses and causing many downstream problems.

We are developing a number of tools for stress-testing calculations, images, and data. These are collected into our [Forensic Metascience AI Toolkit](/forensic-metascience-ai-toolkit), some of which we have made public. 


<!-- INTRO_END -->

## The data integrity problem

<!-- MAJOR_ISSUE_STATS -->

## The rigor problem

<!-- ERROR_STATS -->


## The slop problem

<!-- NHANES_CHARTS -->


## The oversight problem
The number of scientific papers being published each year is growing exponentially with a doubling time of [approximately 10 years](https://www.crossref.org/blog/2026-public-data-file-now-available/#:~:text=12.7%20million%20new%20records%20(a%207.6%25%20increase%20since%20last%20year).). Meanwhile, the number of fake papermill papers being published has been estimated to be doubling [every 1.5 years](https://www.pnas.org/doi/10.1073/pnas.2420092122). AI tools make it easier to generate slop papers and fabricate images and data. 

Meanwhile, our ability to detect serious issues in the scientific literature has been constant or decreasing. So far, a handful of largely unpaid image sleuths appear to be responsible for most detections of image issues. 

The US's government's ability to respond to research misconduct has collapsed. In 2025 HHS's Office of Research Integrity's produced the fewest misconduct findings in its 32 years of record. That same year, [NSF's Office of Inspector General stopped investigating research misconduct](https://www.science.org/content/article/exclusive-nsf-watchdog-unit-no-longer-investigating-research-misconduct), referring all allegations back to grantee institutions. (Prior to 2025, the OIG had made about [10–20 misconduct findings per year](https://www.science.org/content/article/data-check-nsf-sends-congress-garbled-message-misconduct-numbers), 80% of which were for plagiarism. 

<!-- ORI_CHART -->

<!-- NSF_OIG_CHART -->

Peer review is useful for catching major issues, but the peer review system is under increasing strain. Studies indicate that peer reviewers do a very incomplete job. Across [four](https://doi.org/10.1001/jama.280.3.237) [independent](https://www.bmj.com/content/bmj/328/7441/673.full.pdf) [studies](https://journals.sagepub.com/doi/full/10.1258/jrsm.2008.080062) [in biomedicine](https://www.sciencedirect.com/science/article/abs/pii/S019606449870006X) where researchers deliberately inserted errors into manuscripts, peer reviewers only caught 25–35% of them.

## Lessons from previous initiatives

We are not the first people to have the idea of using AI to find errors in the published scientific literature.

The first major initiative along these lines was **The Black Spatula project**, which [was launched](https://secondthoughts.ai/p/the-black-spatula-project) as a crowdsourced initiative by Steve Newman in December 2024. The goal was to run the best AI model at the time (o1 preview) on thousands of papers to catch important mistakes. Several hundred people joined the Black Spatula Discord and WhatsApp group, resulting in an initial burst of activity lasting a few weeks. The project eventually petered out after a year or so. We did an “autopsy” on the Black Spatula project to see if there was anything we could learn that would inform our own project. It appears the initiative petered out due to lack of central coordination, high rates of false positives, and lack of volunteers to perform the arduous work of reviewing all the AI outputs and deciding how to act on them.

Another initiative was **YesNoError**, which was also founded in December 2024. The project was funded by a Solana coin/token that reached a peak market cap of \$110 million. YesNoError evaluated 37,000+ papers in two months using o1, with a stated aspiration to audit 90 million. They then publicized the flagged papers, mostly without any human verification. In March 2025, science integrity expert Nick Brown [found a](https://www.nature.com/articles/d41586-025-00648-5#:~:text=.%20Among%2040%20papers,wrong%2C%20he%20says.) false positive rate of 35% in a small sample of 40 papers. Shortly after, all of the results of the run disappeared from the internet and the website pivoted to focusing solely on AI research papers.

## Experiments with “targeting funnels”

We are experimenting with different ways of doing screening/targeting to decide which papers to audit with the toolkit. We have entered into an unpaid collaboration with [IntelliCat](https://intellicat.ai) to test if their system could be helpful. IntelliCat has generated “Content Credibility Index” (CCI) scores for millions of papers. For a much smaller number of papers, they have also generated Data and Observations Risk Index (DORI) scores based on “domain-specific models to assess experimental data and figures for signals of manipulation or fabrication”. Initial work with our replication database indicates that a bad DORI strongly increases the chances of replication failure by 8x, so we are particularly interested in using the DORI for targeting. We are also looking at doing screening using very cheap AI APIs on thousands of open-access papers that are available in XML format to find “canary in the coal mine” issues that may be indicative of more serious issues. Another approach to targeting we are exploring is running the toolkit on papers by authors who have retractions reported by Retraction Watch.
