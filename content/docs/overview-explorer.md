# About the Metascience Observatory Explorer

The [Metascience Observatory Explorer](https://explore.metascienceobservatory.org) exposes a variety of open source scientometrics datasets to the user in a single user interface, allowing the rapid exploration of linkages between papers, researchers, institutions, journals, funders, and clinical trials. It provides much of the same functionality as paid services such as [Dimensions](https://www.dimensions.ai/), Scopus, and Web of Science. If you find it useful, please [consider donating](/#donate) to support further development. 

We have found that the citaiton data on the Explorer is more comprehensive than what you'll find on Google Scholar. The downside is that authors are not as well disambiguated, so sometimes papers are wrongly attributed across researchers who share the same name. The same researcher may have two different pages as well (stemming from two separate OpenAlex IDs), unfortunately this is quite common at the moment. 

The Explorer is primarily based on the 2025 [SciSciNet-V2 dataset](https://northwestern-cssi.github.io/sciscinet/) which is licensed under an [MIT License](https://github.com/kellogg-cssi/SciSciNet/blob/main/LICENSE). If you find this explorer useful for your work, make sure to acknowledge and cite the [SciSciNet paper](https://www.nature.com/articles/s41597-023-02198-9)[^1].

As already mentioned, author disambiguation is a key challenge when working with scienceometrics data. SciSciNet-V2 is based on OpenAlex's author IDs. OpenAlex assigns these IDs algorithmically, using the author's name, publication record, citation patterns, and ORCID where one is available.[^2] Despite this, author disambiguation remains an known issue.  


## SciSciNet-V2 data sources

SciSciNet-V2 integrates data from a range of upstream sources. The original SciSciNet (V1) was built on top of the Microsoft Academic Graph (MAG), which was sunset by Microsoft at the end of 2021. SciSciNet-V2 replaces MAG with [OpenAlex](https://openalex.org/) as its core bibliographic graph. Topic classifications from MAG survive in the dataset. The following datasets were incorporated by the SciSciNet team: 


- [OpenAlex](https://openalex.org/) — papers, authors, institutions, journals, concepts, and citation links. 
- [PubMed](https://pubmed.ncbi.nlm.nih.gov/) — biomedical publication records with PubMed IDs, used to link papers to NIH projects, clinical trials, and other biomedical entities.
- [NIH RePORTER](https://reporter.nih.gov/) — data on NIH-funded grants with linkages to publications, patents, and clinical studies.
- [NSF Awards](https://www.nsf.gov/awardsearch/) — data on NSF-funded grants with linkages to publications.
- [ClinicalTrials.gov](https://clinicaltrials.gov/) — clinical studies and their linkages to papers.
- [PatentsView](https://patentsview.org/) and patent-to-science citations — USPTO and EPO patent records and citations linking to other patents and papers.
- [Crossref Event Data](https://www.eventdata.crossref.org/guide/) — online attention metadata used to track mentions of papers in news feeds and on Twitter/X.
- Nobel Laureate publication records — publication and prize-winning paper records for Nobel laureates, used to flag laureate-authored work. 
- [SPECTER2 paper embeddings](https://github.com/allenai/SPECTER2) - these are 768-dimensional vectors for 100M+ papers, computed with a model from Allen AI. 

We have ingested almost all the data from SciSci-Net-v2 except for the paper embeddings (which are 1.7 Tb), the field normalized citation scores, and the Nobel Laureate dataset.


## Additional data sources

Beyond SciSciNet-V2, we have incorporated data from the following sources:

- [OpenAIRE Graph](https://graph.openaire.eu/) (v11.1.1, June 2026) — a large open scholarly knowledge graph funded by the European Commission, used under a [CC-BY 4.0 license](https://creativecommons.org/licenses/by/4.0/)[^3]. From its bulk data dump we incorporated: open access status for papers (gold/green/bronze/hybrid and diamond-journal flags), links from papers to 3.9 million funded projects from the European Commission and roughly 40 national funding agencies (complementing the NIH and NSF grant data), links from papers to related research datasets and software, institutional project portfolios, and 33.5 million additional DOI-bearing papers that are not present in SciSciNet-V2.
- [Scopus Source Title List](https://www.scopus.com/sources) (November 2025) — journal metadata, ISSNs, publishers, coverage dates, open access status, and ASJC subject classifications. Used to enrich journal records and to add Scopus-indexed journals that are not present in OpenAlex.
- [Directory of Open Access Journals (DOAJ)](https://doaj.org/) (December 2025) — open access licensing information, Article Processing Charges (APCs), Library of Congress Classification (LCC) codes, and language coverage for open access journals.
- [Retraction Watch Database](https://retractionwatch.com/retraction-watch-database-user-guide/) — retracted paper records matched by DOI and PMID, including retraction dates and reasons.
- [Retraction Watch Hijacked Journal Checker](https://retractionwatch.com/the-retraction-watch-hijacked-journal-checker/) — a registry of hijacked (counterfeit) journals, used to flag potentially fraudulent journal entries.
- [Stop Predatory Journals](https://github.com/stop-predatory-journals/stop-predatory-journals.github.io) (based on [Beall's List](https://beallslist.net/)) — standalone predatory journals and predatory publishers used to flag journals of questionable quality.
- [MeSH (Medical Subject Headings)](https://www.nlm.nih.gov/mesh/meshhome.html) — the 2026 edition of the NLM biomedical controlled vocabulary, including descriptors, scope notes, and the full tree hierarchy.
- [MEDLINE / PubMed Baseline](https://ftp.ncbi.nlm.nih.gov/pubmed/baseline/) — used to extract MeSH term annotations for biomedical papers and link them back to the knowledge graph.
- [ClinicalTrials.gov](https://clinicaltrials.gov/) (December 2025 snapshot) -- provides full trial registration details (titles, conditions, interventions, sponsors, phases, enrollment, and status).


[^1]: Lin, Z., Yin, Y., Liu, L. et al. SciSciNet: A large-scale open data lake for the science of science research. *Sci Data* 10, 315 (2023). [https://doi.org/10.1038/s41597-023-02198-9](https://doi.org/10.1038/s41597-023-02198-9)

[^2]: OpenAlex, [Author disambiguation](https://help.openalex.org/hc/en-us/articles/24347048891543-Author-disambiguation).

[^3]: Manghi, P., Atzori, C., Bardi, A., et al. OpenAIRE Graph Dataset (v11.1.1). *Zenodo*. [https://doi.org/10.5281/zenodo.3516917](https://doi.org/10.5281/zenodo.3516917)


