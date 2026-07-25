# How Much of the Literature Is Replication? A Cross-Disciplinary Review of Prevalence Estimates

*Metascience Observatory*

---

## Summary

Published estimates of what share of the scientific literature consists of replication studies span **three orders of magnitude**, from 0.023% in ecology and evolution to 17.7% among controlled experiments in software engineering. Most of that spread is *measurement artefact*, not genuine cross-field variation.

Three design choices drive almost all of the variance:

1. **The denominator.** All published articles, or only empirical articles, or only experiments? Restricting to empirical articles alone inflates estimates by roughly an order of magnitude.
2. **The detection method.** Full-corpus keyword sweeps (`replicat*`) versus hand-coding of random samples. Sweeps depend entirely on authors *self-labelling* their work as replication; hand-coded samples do not, and consistently return higher rates.
3. **The definition.** Direct/exact replications are a small minority of everything called a replication — 28.5% in education, roughly 18% in psychology, and 4 of 240 studies in top management journals.

Once these are held constant, the field-level picture is remarkably uniform: **self-labelled replications are on the order of 0.1–1% of the published literature across psychology, education, criminology, economics, management, applied linguistics, and ecology alike.** Reported rates outside that band nearly always signal a different denominator or a broader definition rather than a different research culture.

A second, much more robust finding recurs in every field where it has been tested: **replications that share an author with the original study succeed far more often than independent ones.** This has now replicated in education, special education (three separate reviews), criminology, and management. It is the single most consistent result in this literature.

---

## 1. Why prevalence is hard to measure

Almost every prevalence estimate in this literature descends from one protocol, introduced by Makel, Plucker and Hegarty (2012) and applied with minor variations ever since:

1. Select a journal set (typically top-*n* by impact factor, or an ISI/JCR subject category).
2. Search the full text of every article for the stem `replicat*`.
3. Hand-code a random subsample of hits to estimate precision.
4. Multiply raw hits by the precision correction factor.

The protocol is transparent and reproducible, which is why it has been reused so widely. It also has two structural limitations that any consumer of these numbers needs to hold in mind.

**Precision.** In psychology, only 68.4% of articles containing `replicat*` were actual replications — the term appears in discussion sections ("these findings require replication"), in design descriptions ("replicated treatments"), and in molecular biology contexts ("DNA replication"). Without a correction factor, keyword hits overstate prevalence by roughly 50%.

**Recall.** This is the more serious problem, and it is unaddressed. Every keyword-based estimate is a *floor*, because it can only find replications whose authors chose to describe them as such. Kelly (2019) is explicit that his 0.023% figure for ecology likely underestimates the true rate, and notes the tension with his own earlier finding that 25–34% of behavioural ecology papers were partial or conceptual replications — a discrepancy plausibly explained by conceptual replicators simply not using the word. Given documented editorial and reviewer preference for novelty (Neuliep & Crandall, 1990, 1993), there is a clear incentive *not* to label work as replication, which biases every sweep-based estimate downward by an unknown amount.

Hensel (2021) is the only systematic review that treats this measurement problem head-on, synthesising 67 studies and showing explicitly how sampling method determines the size of the resulting estimate. It should be read before any of the individual numbers below are compared to each other.

---

## 2. The education sciences: the best-documented case

Education is the field with the most complete evidentiary record, including a genuine within-field replication of the prevalence estimate itself — and, remarkably, an *inadvertent* concurrent replication.

| Study | Corpus | Period | Replication rate | Success rate | Notes |
|---|---|---|---|---|---|
| Makel & Plucker (2014) | Top 100 education journals | full history | **0.13%** (221 / 164,589) | 67.4% full, 19.5% partial, 13.1% none | 28.5% direct |
| Makel et al. (2016) | 36 special education journals (JCR) | full history | **0.50%** (229 / 45,490) | >80% | ~⅔ had author overlap |
| Lemons et al. (2016) | Special education journals | full history | **0.41%** | — | Concurrent, independent replication of Makel et al. (2016) |
| Perry, Morris & Lea (2022) | Education journals (WoS) | 2011–2020 | **~0.20%** (442 studies) | Many null | Approximate replication of Makel & Plucker (2014) |
| Cook et al. (2025) | 44 special education journals | 2015–2022 | **0.54%** (78 studies) | Most successful | Journal IF positively associated with replication rate |

Three observations from this cluster:

- **The estimate replicates.** Lemons et al. (2016) and Makel et al. (2016) independently reviewed the same literature for the same special issue of *Remedial and Special Education*, unaware of each other, and returned 0.41% and 0.50%. That is close agreement given differing inclusion criteria, and it is the strongest available evidence that the sweep protocol is reliable within a field.
- **The rate is rising, slowly.** Education moved from 0.13% (full history to 2013) to ~0.20% (2011–2020). Special education has been flat at 0.4–0.54% across three reviews spanning roughly three decades of publication — Cook et al.'s title, *Same as It Ever Was*, is the finding.
- **Special education runs ~3–4× the general education rate**, consistently across all three reviews. This is one of the few apparent cross-field differences that survives methodological standardisation, since all four studies used near-identical protocols.

A caution for anyone citing the Perry et al. (2022) literature review: it describes Lemons et al.'s 0.41% as "higher than the 0.52% from Makel et al. (2016)," which is internally inconsistent. It also attributes 0.52% to Makel et al., whose reported figure is 0.5% (229/45,490 = 0.503%).

---

## 3. Cross-field estimates

### Table A — Full-corpus keyword sweeps, denominator = all published articles

This is the most nearly comparable set of estimates in the literature. Unless noted, method is a full-text `replicat*` search across a defined journal set.

| Field | Rate | Corpus | Source |
|---|---|---|---|
| Forecasting | 8.4% | International Journal of Forecasting and related | Evanschitzky & Armstrong (2010) |
| Business & management (any replication element) | 1.47% | 121 AJG journals, 83,682 articles, 2008–2017 | Ryan & Tipu (2022) |
| Marketing | 1.2% | Leading marketing journals | Evanschitzky et al. (2007) |
| **Psychology** | **1.07%** | Top 100 journals, since 1900 | Makel, Plucker & Hegarty (2012) |
| Advertising | 0.8% | Journal of Advertising et al., 1977–1979 | Reid, Soley & Winner (1981) |
| Special education | 0.41–0.54% | 36–44 journals, three reviews | Lemons et al. (2016); Makel et al. (2016); Cook et al. (2025) |
| **Criminology** | **0.45%** | 52 ISI journals, 39,275 articles | Pridemore, Makel & Plucker (2018) |
| Second-language research | ~0.25% | 26 journals; 67 replications | Marsden et al. (2018) |
| **Education** | **0.13% → 0.20%** | Top 100 journals | Makel & Plucker (2014); Perry et al. (2022) |
| Management (independent replications only) | ~0.15% | 56 top journals, 159,242 articles | Block et al. (2023) |
| **Economics** | **0.10%** | Top 50 journals, 126,505 articles, 1974–2014 | Mueller-Langer et al. (2019) |
| Finance | ~0.1% | Leading finance journals | Hubbard & Vetter (1991) |
| **Ecology & evolution** | **0.023%** | 160 OA journals, 38,730 papers | Kelly (2019) |
| Marketing (direct only) | 0% | Leading marketing journals | Hubbard & Armstrong (1994) |

**Notes.** Forecasting is a genuine outlier, but in a small and unusually replication-friendly specialty literature. Kelly (2019) separately swept *PeerJ* and found 1 replication in 3,343 papers (0.03%), statistically indistinguishable from the ecology-specific rate — evidence against the hypothesis that replications simply migrate to multidisciplinary venues. Ryan & Tipu's comparatively high 1.47% is largely explained by their inclusion of *within-study* (intrastudy) replications, which do not address researcher bias or error at all.

### Table B — Denominator = empirical or experimental articles only

Restricting the denominator raises estimates by roughly 10–100×. These numbers are **not comparable** to Table A.

| Field | Rate | Denominator | Source |
|---|---|---|---|
| Software engineering | 17.7% (20 / 113) | Controlled experiments identified in 5,453 articles | Sjøberg et al. (2005) |
| Behavioural ecology | 25–34% partial/conceptual; **0% exact** | Papers in top 3 journals | Kelly (2006) |
| Accounting, economics, finance, management, marketing | 6.2% (266 / 4,270) | Empirical studies, 18 journals, 1970–1991 | Hubbard & Vetter (1996) |
| — management subset | 5.3% (65 / 1,222) | Empirical studies | Hubbard & Vetter (1996) |
| Strategic management | 5.3% (37 / 701) | Articles, 1976–1995 | Hubbard, Vetter & Little (1998) |
| Advertising / marketing / communication | ~6% (30 / 501) | Articles, broad definition | Reid, Soley & Winner (1981) |
| Development economics | 5.4% (57 / 1,056) | Articles subject to replication (target-side) | Sukhtankar (2017) |

**Note.** Sukhtankar's figure measures a genuinely different quantity — the share of *original* papers that have been replicated, rather than the share of papers that *are* replications. For assessing evidence-base reliability this is arguably the more informative metric, and it is almost never reported.

### Table C — Hand-coded random samples

Immune to self-labelling bias, but small-*N* and therefore imprecise.

| Field | Rate | Sample | Source |
|---|---|---|---|
| Communication (any replication framing) | ~14% (1 in 7) | Representative sample, 2007–2016 | Keating & Totzkay (2019) |
| Communication (direct only) | ~1.8% | Same | Keating & Totzkay (2019) |
| Psychology | 5% (10 / 188) | Random empirical articles, 2014–2017 | Hardwicke et al. (2020) |
| Criminology | 2.34% | 5 leading journals, 2006–2010 | McNeeley & Warner (2015) |
| Social sciences | 1% (2 / 156) | Random articles, 2014–2017 | Hardwicke et al. (2020) |
| Biomedicine | ~0.9% (4 / 441) | Random articles, 2000–2014 | Iqbal et al. (2016) |

**The comparison that matters.** Psychology returns 1.07% by keyword sweep and 5% by hand-coded random sample — a ~5× gap. Criminology returns 0.45% by sweep and 2.34% by hand-coding — also ~5×. Communication returns ~1.8% for direct replications by hand-coding, against psychology's ~0.2% direct rate by sweep. The pattern is consistent enough to suggest that **keyword sweeps recover roughly one-fifth of the replication literature**, and that true prevalence in the social sciences is plausibly in the low single-digit percentages rather than the fractions of a percent usually quoted.

---

## 4. Recurring substantive findings

### 4.1 Author overlap predicts success

The most robust result in this literature, and the most consequential.

| Field | Independent replications | Shared author(s) | Source |
|---|---|---|---|
| Education | 54% success | 70.6% (≥1 shared author); 88.7% (same authors, same publication) | Makel & Plucker (2014) |
| Special education | Lower | Significantly higher; overlap in ~⅔ of cases | Makel et al. (2016) |
| Special education (2015–2022) | Lower | Significantly higher | Cook et al. (2025) |
| Software engineering | 29% of replications external | 71% internal; internal more likely to confirm | da Silva et al. (2014); Bezerra et al. |
| Management | — | Lack of author independence flagged as a core problem | Ryan & Tipu (2022) |

Two implications. First, **headline success rates from the observational replication literature are inflated**, because most published replications are not independent. Second, any database of replications should treat author overlap as a first-class field, not an annotation.

### 4.2 Most "replications" are not direct

| Field | Direct / exact share | Source |
|---|---|---|
| Education | 28.5% | Makel & Plucker (2014) |
| Psychology | ~18% | Makel, Plucker & Hegarty (2012) |
| Management (top journals) | 4 of 240 literal; 57.9% "quasirandom" | Block et al. (2023) |
| Behavioural ecology | 0% exact | Kelly (2006) |
| Communication | Minority; conceptual predominates | Keating & Totzkay (2019) |

Block et al.'s finding deserves emphasis: the modal replication in top management journals is *quasirandom* — it differs from the original without improving on it, which is the category of least evidential value.

### 4.3 Observational success rates are high; experimental ones are not

Prevalence and replicability are distinct quantities, and the literature on each tells a different story. Observational surveys of *self-labelled, mostly non-independent* published replications report high success; prospective multi-lab projects report much lower.

| Source of estimate | Field | Success rate |
|---|---|---|
| Published replications (observational) | Education | 67.4% full, 19.5% partial |
| Published replications (observational) | Special education | >80% |
| Published replications (observational) | Criminology | ~75% successful, 15% mixed |
| Published replications (observational) | Management | 79.6% at least partially confirming |
| Many Labs 1 | Psychology | 77% |
| Camerer et al. (2018) | Social science (*Nature*/*Science*) | 62% |
| Camerer et al. (2016) | Experimental economics | 61% |
| Many Labs 2 | Psychology | 54% |
| Ioannidis (2005) | Highly cited clinical research | 44% |
| Open Science Collaboration (2015) | Psychology | 36% (vs 97% significant originals) |
| Murphy et al. (2025) | Sports & exercise science | 28%, with substantial effect-size shrinkage |
| Prinz et al. (2011) | Preclinical pharmacology | ~35% (as summarised by Kelly, 2019) |
| Begley & Ellis (2012) | Landmark preclinical cancer | 11% |

The gap between the top and bottom of this table is not a puzzle: it is selection. The observational figures describe which replications get *published*, and Block et al. (2023) showed that non-confirming replications in management are cited significantly less often than confirming ones — a confirmation bias operating at the citation level on top of the one operating at publication.

### 4.4 Selection of targets, and beliefs about prevalence

- **High-impact articles are more likely to be replicated**, but articles in top-5 economics journals are *less* likely; mandatory data disclosure policies raise replication probability (Mueller-Langer et al., 2019).
- **Journal impact factor is positively associated with journal-level replication rates** in special education (Cook et al., 2025).
- **Replication lags are long.** In second-language research, a mean of 6.64 years elapsed between original and replication, and originals had accumulated a mean of 117 citations before any replication appeared (Marsden et al., 2018).
- **Researchers wildly overestimate prevalence.** Surveyed ecologists' median estimate of the direct replication rate in their field was 10%; the measured rate is 0.023%. 97% considered replication important and 91% thought it insufficiently prevalent (Fraser et al., 2020).

---

## 5. Where the map is blank

No article-share prevalence estimate could be located for:

- **Chemistry, physics, materials science, non-software engineering, earth sciences, mathematics and statistics, agronomy**
- **Nursing, most clinical specialties, public health**
- **Sociology, political science, anthropology, geography**

Political science has a substantial data-availability and computational-reproducibility literature but, to our knowledge, no published estimate of the replication share of its article output. Ecology and evolution is the only natural-science field with a proper full-corpus sweep — which suggests the binding constraint has been full-text corpus access rather than disciplinary interest.

Filling these gaps is the most obvious open opportunity in this literature, and it is now largely a tooling problem rather than a conceptual one.

---

## 6. Implications and recommendations

**For consumers of these figures.** No prevalence number is interpretable without three accompanying parameters: the denominator definition, the detection method, and the direct/conceptual split. Cross-field comparisons that ignore them — including several that circulate widely — are comparing measurement protocols, not research cultures.

**For future prevalence studies.**

1. **Report the triple.** Denominator, detection method, direct/conceptual split, every time.
2. **Attack recall, not just precision.** Every existing estimate is a floor set by author self-labelling. A classifier that identifies *unlabelled* replication attempts from full text — same hypothesis, same population, cites the original, compares results — would produce the first estimate that is not a lower bound. Given the ~5× gap between sweep and hand-coded estimates, the correction is likely to be large.
3. **Calibrate against existing gold standards.** Makel & Plucker (2014), Kelly (2019), and Cook et al. (2025) provide published counts across three fields spanning three orders of magnitude, with defined corpora. Any automated pipeline should reproduce them before being extended to new fields.
4. **Report target-side rates too.** The share of original findings that have ever been independently tested (Sukhtankar's metric) speaks more directly to evidence-base reliability than the share of articles that are replications.
5. **Code author overlap and independence explicitly.** Success rates that pool independent and non-independent replications are not informative about the reliability of the literature.

**For fields with no estimate.** The sweep protocol is inexpensive and well-validated. Extending it to materials science, engineering, chemistry and the clinical specialties would substantially expand what is currently a social-science-and-ecology-shaped map of the problem.

---

## References

Begley, C. G., & Ellis, L. M. (2012). Drug development: Raise standards for preclinical cancer research. *Nature*, 483(7391), 531–533. https://doi.org/10.1038/483531a

Block, J. H., Fisch, C., Kanwal, N., Lorenzen, S., & Schulze, A. (2023). Replication studies in top management journals: An empirical investigation of prevalence, types, outcomes, and impact. *Management Review Quarterly*, 73(3), 1109–1134. https://doi.org/10.1007/s11301-022-00269-6

Camerer, C. F., Dreber, A., Forsell, E., Ho, T.-H., Huber, J., Johannesson, M., … Wu, H. (2016). Evaluating replicability of laboratory experiments in economics. *Science*, 351(6280), 1433–1436. https://doi.org/10.1126/science.aaf0918

Camerer, C. F., Dreber, A., Holzmeister, F., Ho, T.-H., Huber, J., Johannesson, M., … Wu, H. (2018). Evaluating the replicability of social science experiments in *Nature* and *Science* between 2010 and 2015. *Nature Human Behaviour*, 2(9), 637–644. https://doi.org/10.1038/s41562-018-0399-z

Cook, B. G., Therrien, W. J., Waterfield, D. A., McClain, S., Fleming, J. I., Robinson, H., Watson, L., & Boyle, J. (2025). Same as it ever was: An updated review of replication studies in special education journals. *Remedial and Special Education*. https://doi.org/10.1177/07419325241248766

da Silva, F. Q. B., Suassuna, M., França, A. C. C., Grubb, A. M., Gouveia, T. B., Monteiro, C. V. F., & dos Santos, I. E. (2014). Replication of empirical studies in software engineering research: A systematic mapping study. *Empirical Software Engineering*, 19(3), 501–557. https://doi.org/10.1007/s10664-012-9227-7

Evanschitzky, H., & Armstrong, J. S. (2010). Replications of forecasting research. *International Journal of Forecasting*, 26(1), 4–8. https://doi.org/10.1016/j.ijforecast.2009.09.003

Evanschitzky, H., Baumgarth, C., Hubbard, R., & Armstrong, J. S. (2007). Replication research's disturbing trend. *Journal of Business Research*, 60(4), 411–415. https://doi.org/10.1016/j.jbusres.2006.12.003

Fraser, H., Barnett, A., Parker, T. H., & Fidler, F. (2020). The role of replication studies in ecology. *Ecology and Evolution*, 10(12), 5197–5207. https://doi.org/10.1002/ece3.6330

Hardwicke, T. E., Thibault, R. T., Kosie, J. E., Wallach, J. D., Kidwell, M. C., & Ioannidis, J. P. A. (2022). Estimating the prevalence of transparency and reproducibility-related research practices in psychology (2014–2017). *Perspectives on Psychological Science*, 17(1), 239–251. https://doi.org/10.1177/1745691620979806

Hensel, P. G. (2021). Reproducibility and replicability crisis: How management compares to psychology and economics — A systematic review of literature. *European Management Journal*, 39(5), 577–594. https://doi.org/10.1016/j.emj.2021.01.002

Hubbard, R., & Armstrong, J. S. (1994). Replications and extensions in marketing: Rarely published but quite contrary. *International Journal of Research in Marketing*, 11(3), 233–248. https://doi.org/10.1016/0167-8116(94)90003-5

Hubbard, R., & Vetter, D. E. (1991). Replications in the finance literature: An empirical study. *Quarterly Journal of Business and Economics*, 30, 70–81.

Hubbard, R., & Vetter, D. E. (1996). An empirical comparison of published replication research in accounting, economics, finance, management, and marketing. *Journal of Business Research*, 35(2), 153–164. https://doi.org/10.1016/0148-2963(95)00084-4

Hubbard, R., Vetter, D. E., & Little, E. L. (1998). Replication in strategic management: Scientific testing for validity, generalizability, and usefulness. *Strategic Management Journal*, 19(3), 243–254.

Ioannidis, J. P. A. (2005). Contradicted and initially stronger effects in highly cited clinical research. *JAMA*, 294(2), 218–228. https://doi.org/10.1001/jama.294.2.218

Iqbal, S. A., Wallach, J. D., Khoury, M. J., Schully, S. D., & Ioannidis, J. P. A. (2016). Reproducible research practices and transparency across the biomedical literature. *PLOS Biology*, 14(1), e1002333. https://doi.org/10.1371/journal.pbio.1002333

Keating, D. M., & Totzkay, D. (2019). We do publish (conceptual) replications (sometimes): Publication trends in communication science, 2007–2016. *Annals of the International Communication Association*, 43(3), 225–239. https://doi.org/10.1080/23808985.2019.1632218

Kelly, C. D. (2006). Replicating empirical research in behavioral ecology: How and why it should be done but rarely ever is. *The Quarterly Review of Biology*, 81(3), 221–236. https://doi.org/10.1086/506236

Kelly, C. D. (2019). Rate and success of study replication in ecology and evolution. *PeerJ*, 7, e7654. https://doi.org/10.7717/peerj.7654

Klein, R. A., Ratliff, K. A., Vianello, M., Adams, R. B., Bahník, Š., Bernstein, M. J., … Nosek, B. A. (2014). Investigating variation in replicability: A "many labs" replication project. *Social Psychology*, 45(3), 142–152. https://doi.org/10.1027/1864-9335/a000178

Klein, R. A., Vianello, M., Hasselman, F., Adams, B. G., Adams, R. B., Alper, S., … Nosek, B. A. (2018). Many Labs 2: Investigating variation in replicability across samples and settings. *Advances in Methods and Practices in Psychological Science*, 1(4), 443–490. https://doi.org/10.1177/2515245918810225

Köhler, T., & Cortina, J. M. (2021). Play it again, Sam! An analysis of constructive replication in the organizational sciences. *Journal of Management*, 47(2), 488–518.

Lemons, C. J., King, S. A., Davidson, K. A., Berryessa, T. L., Gajjar, S. A., & Sacks, L. H. (2016). An inadvertent concurrent replication: Same roadmap, different journey. *Remedial and Special Education*, 37(4), 213–222.

Makel, M. C., & Plucker, J. A. (2014). Facts are more important than novelty: Replication in the education sciences. *Educational Researcher*, 43(6), 304–316. https://doi.org/10.3102/0013189X14545513

Makel, M. C., & Plucker, J. A. (2015). An introduction to replication research in gifted education: Shiny and new is not the same as useful. *Gifted Child Quarterly*, 59(3), 157–164. https://doi.org/10.1177/0016986215578747

Makel, M. C., Plucker, J. A., Freeman, J., Lombardi, A., Simonsen, B., & Coyne, M. (2016). Replication of special education research: Necessary but far too rare. *Remedial and Special Education*, 37(4), 205–212. https://doi.org/10.1177/0741932516646083

Makel, M. C., Plucker, J. A., & Hegarty, B. (2012). Replications in psychology research: How often do they really occur? *Perspectives on Psychological Science*, 7(6), 537–542. https://doi.org/10.1177/1745691612460688

Marsden, E., Morgan-Short, K., Thompson, S., & Abugaber, D. (2018). Replication in second language research: Narrative and systematic reviews and recommendations for the field. *Language Learning*, 68(2), 321–391. https://doi.org/10.1111/lang.12286

McEwan, B., Carpenter, C. J., & Westerman, D. (2018). On replication in communication science. *Communication Studies*, 69(3), 235–241. https://doi.org/10.1080/10510974.2018.1464938

McNeeley, S., & Warner, J. J. (2015). Replication in criminology: A necessary practice. *European Journal of Criminology*, 12(5), 581–597.

Mueller-Langer, F., Fecher, B., Harhoff, D., & Wagner, G. G. (2019). Replication studies in economics — How many and which papers are chosen for replication, and why? *Research Policy*, 48(1), 62–83. https://doi.org/10.1016/j.respol.2018.07.019

Murphy, J., Caldwell, A. R., Mesquida, C., Ladell, A. J. M., et al. (2025). Estimating the replicability of sports and exercise science research. *Sports Medicine*. https://doi.org/10.1007/s40279-025-02201-w

Neuliep, J. W., & Crandall, R. (1990). Editorial bias against replication research. *Journal of Social Behavior and Personality*, 5, 85–90.

Neuliep, J. W., & Crandall, R. (1993). Reviewer bias against replication research. *Journal of Social Behavior and Personality*, 8, 21–29.

Open Science Collaboration. (2015). Estimating the reproducibility of psychological science. *Science*, 349(6251), aac4716. https://doi.org/10.1126/science.aac4716

Perry, T., Morris, R., & Lea, R. (2022). A decade of replication study in education? A mapping review (2011–2020). *Educational Research and Evaluation*, 27(1–2), 12–34. https://doi.org/10.1080/13803611.2021.2022315

Plucker, J. A., & Makel, M. C. (2021). Replication is important for educational psychology: Recent developments and key issues. *Educational Psychologist*, 56(2), 90–100. https://doi.org/10.1080/00461520.2021.1895796

Pridemore, W. A., Makel, M. C., & Plucker, J. A. (2018). Replication in criminology and the social sciences. *Annual Review of Criminology*, 1, 19–38. https://doi.org/10.1146/annurev-criminol-032317-091849

Prinz, F., Schlange, T., & Asadullah, K. (2011). Believe it or not: How much can we rely on published data on potential drug targets? *Nature Reviews Drug Discovery*, 10(9), 712. https://doi.org/10.1038/nrd3439-c1

Reid, L. N., Soley, L. C., & Winner, R. D. (1981). Replication in advertising research: 1977, 1978, 1979. *Journal of Advertising*, 10(1), 3–13.

Ryan, J. C., & Tipu, S. A. A. (2022). Business and management research: Low instances of replication studies and a lack of author independence in replications. *Research Policy*, 51(1), 104408. https://doi.org/10.1016/j.respol.2021.104408

Simonsohn, U. (2015). Small telescopes: Detectability and the evaluation of replication results. *Psychological Science*, 26(5), 559–569. https://doi.org/10.1177/0956797614567341

Sjøberg, D. I. K., Hannay, J. E., Hansen, O., Kampenes, V. B., Karahasanović, A., Liborg, N.-K., & Rekdal, A. C. (2005). A survey of controlled experiments in software engineering. *IEEE Transactions on Software Engineering*, 31(9), 733–753.

Sukhtankar, S. (2017). Replications in development economics. *American Economic Review*, 107(5), 32–36.

Travers, J. C., Cook, B. G., Therrien, W. J., & Coyne, M. D. (2016). Replication research and special education. *Remedial and Special Education*, 37(4), 195–204. https://doi.org/10.1177/0741932516648462

---

### Notes on sources

Block et al. (2023) report replication outcomes in two places that do not fully agree: the introduction states that 79.6% of replications at least partially replicated the original and 20.4% did not, while Section 4.3 reports 20.4% fully replicated, 47.9% at least partially, and 31.7% not at all. We cite the abstract/introduction framing above.

Prinz et al. (2011) is a correspondence piece reporting internal Bayer figures; the ~35% success rate quoted here is as summarised by Kelly (2019), and readers should consult the original for its precise basis.

Figures attributed to Hardwicke et al. (2020) in secondary sources correspond to the psychology and social science prevalence surveys published as Hardwicke et al. (2022) and its social-science companion.