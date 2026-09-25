# Metascience Observatory website audit — 18 September 2026

**The highest-priority issues concern scientific results, not compilation:** baseline measurements enter the RLS pairwise meta-analysis; ratio measures receive incorrect direction labels; companion reports are counted as separate trials. The bibliography endpoint also fails, and dependency security patches are outstanding.

Reviewed local commit `d8647bb`, database `replications_database_2026_09_04_184008.csv` (8,892 effect rows). Findings describe this checkout unless stated otherwise. The deployed homepage was inspected, but deployed-code parity was not established. No production records were modified, no messages were sent, and no application fixes were applied.

## Coverage and validation

- Production build: passed, including compilation/type checks and generation of 60 static/build routes.
- HTTP crawl: all 52 page.tsx routes returned 200 from the local production build; checked their rendered internal links and section targets. Two broken section anchors found. The screening-download API was not misclassified as a missing page.
- Browser checks: deployed homepage; local Long COVID default view, intervention-category filtering, publication filter empty state/reset at 390px, and RLS individual-trial expansion/mobile layout. No console errors in those interactions. This was sampled interaction testing, not every possible filter combination or a full accessibility audit.
- Publication unit tests: 8/8 passed. Ingestion unit tests: 66/66 passed. The full existing Playwright suite was not run; the browser checks above were performed through the available browser control.
- Fractional-logit/correlation checks: ran both existing Python and TypeScript oracles. Point estimates, standard errors and average marginal effects matched at the six printed decimals; bootstrap intervals differed slightly as expected from their different random generators. Model A: 6,306 effects / 4,293 clusters; Model B: 453 / 359.
- Lint: failed to run a configured linter; next lint opens a configuration prompt.
- Dependency audit: 8 affected package entries (1 critical, 6 high, 1 low); actual deployment exploitability not established.
- Scientific review: inspected shared replication classifiers, displayed review aggregation/forest data, methodological documentation, and selected primary publications. This is not a line-by-line re-extraction of every paper, a complete security penetration test, or validation of every upstream meta-analysis generator.

## Priorities

P1 = address promptly because the feature fails, scientific conclusions can change, public claims overreach materially, or security patches are missing. P2 = meaningful correctness, interpretation or usability issue. P3 = editorial or measured optimization work. Priority is separate from confidence and exploitability.

## A01 · P1 · RLS forest plots contain baseline differences as treatment effects

**Area:** Science. **Status:** Confirmed.

**Evidence.** For cabergoline, DOI 10.1212/01.wnl.0000147297.51023.c8 is plotted at g = −0.2219 and receives weight 0.2495. This exactly reproduces the PRETREATMENT difference: placebo mean 26.0 (SD 5.5, n=22) versus cabergoline mean 27.2 (SD 5.1, n=21), with Hedges correction. The extracted week-5 change scores are 3.3 versus 13.1 and are different data. An automated cross-check found 39 distinct plotted estimates with baseline-only SMD magnitude matches (32 nonzero), spanning 18 pooled groups. The cabergoline example is confirmed; the wider matches are an audit queue, not 39 independently checked primary-paper errors.

**Why it matters.** The published pooled estimates and drug ordering cannot currently be relied on as estimates of treatment benefit. A successful Next.js build cannot detect this error.

**Suggested fix.** Withdraw or prominently suspend the affected pairwise summaries until the upstream selection code requires post-randomization timepoints, preserves change-score direction, records arm/timepoint provenance, and regenerates the pools. Check all 39 matches against source papers. Do not assume the separate network analysis has the same error without checking its inputs.

**Locations:** [data/birds_eye_reviews/restless_legs_syndrome/meta_analysis.json:49](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/data/birds_eye_reviews/restless_legs_syndrome/meta_analysis.json:49), [app/birds-eye-reviews/restless-legs-syndrome/meta-analysis/MetaAnalysisClientWrapper.tsx:60](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/birds-eye-reviews/restless-legs-syndrome/meta-analysis/MetaAnalysisClientWrapper.tsx:60).

**External support:** [Primary trial](https://pubmed.ncbi.nlm.nih.gov/15623686/).
## A02 · P1 · Long COVID benefit/harm labels use zero as the null for ratio measures

**Area:** Science + code. **Status:** Confirmed.

**Evidence.** Both server outcome counts and client badges use effect > 0 or effect < 0 regardless of measure. OR, RR and HR have null 1. Across the 775 eligible extraction records, 39 first-contrast outcomes in 18 reports have p<.05, a positive ratio below 1, and a known polarity: the zero-based rule reverses their interpretation relative to the stored polarity. For example, the Paxlovid report 10.1001/jamainternmed.2024.2007 contains OR=.55, p=.02 for weeks with mild/no fatigue (higher_is_better=true); the dashboard counts this as favorable. Its antiviral filter visibly shows +Sig=2, −Ctrl=1.

**Why it matters.** The All Trials table can display benefit as harm or harm as benefit. The preferred LLM trial verdict is a separate path, so this finding does not mean every top-chart verdict is wrong.

**Suggested fix.** Centralize direction inference by measure: zero for differences/log ratios and one for raw ratios. Preserve comparison-arm order and the outcome event definition, and validate time-to-event semantics. Use the same helper for counts, sorting, expanded rows, and badges.

**Locations:** [app/birds-eye-reviews/long-covid/page.tsx:366](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/birds-eye-reviews/long-covid/page.tsx:366), [app/birds-eye-reviews/long-covid/LongCovidDashboard.tsx:1663](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/birds-eye-reviews/long-covid/LongCovidDashboard.tsx:1663).

**External support:** [Cochrane effect measures](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-06).
## A03 · P1 · Replication significance fallback misclassifies ratio reversals as successes

**Area:** Science + code. **Status:** Confirmed.

**Evidence.** The raw-effect fallback compares Math.sign(original_es) to Math.sign(replication_es). Positive ratios on opposite sides of 1 therefore agree. Calling the shipped classifier with significant OR=.5 and OR=2 returns success. Two current database rows also enter this failure: original DOI 10.1097/01.hjh.0000254372.88488.a9 (.834 versus 1.15) and 10.1038/ncomms3739 (1.41 versus .7).

**Why it matters.** The significance definition reports replication successes for opposite-direction ratio effects, changing counts wherever the shared utility is used.

**Suggested fix.** Infer direction relative to the metric-specific null and reject uninterpretable metrics. Add regression cases for below/above-one ratios, log ratios, differences, and missing normalized r.

**Locations:** [lib/replicationOutcome.ts:560](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/lib/replicationOutcome.ts:560).
## A04 · P1 · RLS pairwise drug summaries pool different comparators

**Area:** Science. **Status:** Confirmed.

**Evidence.** The cabergoline symptom-severity group combines 10.1002/mds.21401 (cabergoline versus active levodopa/benserazide; weight .3176) with placebo-controlled trials. The displayed grouping is drug × outcome, with no comparator dimension, and readers are invited to compare drugs on one SMD scale. The active comparator is confirmed in the source trial.

**Why it matters.** A contrast against another effective drug is not the same estimand as a contrast against placebo. Standardization alone does not make these pooled drug estimates suitable for comparative efficacy ranking.

**Suggested fix.** Pool within treatment/comparator/outcome/timepoint strata, disclose the comparator on every diamond, and reserve indirect treatment comparisons for a validated network analysis.

**Locations:** [data/birds_eye_reviews/restless_legs_syndrome/meta_analysis.json:36](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/data/birds_eye_reviews/restless_legs_syndrome/meta_analysis.json:36), [app/birds-eye-reviews/restless-legs-syndrome/meta-analysis/MetaAnalysisClientWrapper.tsx:236](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/birds-eye-reviews/restless-legs-syndrome/meta-analysis/MetaAnalysisClientWrapper.tsx:236).

**External support:** [Active-controlled trial](https://pubmed.ncbi.nlm.nih.gov/17274039/).
## A05 · P1 · Different reports of the same Long COVID trial are counted as separate trials

**Area:** Science. **Status:** Confirmed.

**Evidence.** The default dashboard includes both 10.1001/jamanetworkopen.2024.50744 and its economic follow-up 10.1186/s12962-026-00748-7, each with n=314. Both publications identify trial NCT05196451. Both appear in the browser trial table and contribute to intervention counts. DOI/preprint deduplication cannot collapse separate publications from the same trial.

**Why it matters.** Trial and participant totals overstate independent evidence; result rectangles may count the same experiment twice. This is a confirmed example, not an estimate of total duplicate-trial prevalence.

**Suggested fix.** Introduce a trial identifier distinct from report DOI, link companion papers, select outcomes across reports, and count distinct trials/participants. If retaining report-level charts, label them reports and avoid adding repeated participant totals.

**Locations:** [app/birds-eye-reviews/long-covid/page.tsx:281](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/birds-eye-reviews/long-covid/page.tsx:281), [app/birds-eye-reviews/long-covid/facets.ts:1](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/birds-eye-reviews/long-covid/facets.ts:1).

**External support:** [Primary report](https://pubmed.ncbi.nlm.nih.gov/39699896/), [Economic follow-up](https://link.springer.com/article/10.1186/s12962-026-00748-7).
## A06 · P1 · Bibliography uploads with DOIs fail with HTTP 500

**Area:** Code. **Status:** Confirmed.

**Evidence.** POSTing a minimal valid .bib to the local production server returns ENOENT. getLatestFilename retains the inline comment in the final version-history line and tries to open a filename ending in "csv # added collated_results_base_v88_sonnet_400.csv". /api/fred correctly strips the comment.

**Why it matters.** The bibliography feature fails whenever parsing finds a DOI and proceeds to load the database. It also returns the absolute server path in its error body.

**Suggested fix.** Share a single latest-master resolver that ignores full-line/inline comments, checks a nonempty result, and returns a generic public error while logging internal details.

**Locations:** [app/api/upload-bibliography/route.ts:80](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/api/upload-bibliography/route.ts:80).
## A07 · P1 · Installed Next.js has published security advisories

**Area:** Dependencies. **Status:** Confirmed dependency exposure; deployment exploitability untested.

**Evidence.** The build and lockfile resolve Next.js 15.5.15. npm audit --omit=dev reports 8 affected package entries: 1 critical, 6 high, 1 low. These are package-level rollups, not eight proven exploitable site vulnerabilities. The verified AVIF image-optimization advisory affects Next.js before 15.5.24. Other entries concern sharp, postcss, d3-color, js-yaml, nanoid, brace-expansion, and postcss-selector-parser.

**Why it matters.** The committed dependency tree is behind security fixes. Actual exploitability depends on deployed versions, Vercel mitigations, enabled features and accepted inputs; no exploit was attempted. The Windows-specific advisory is not evidence of a Windows issue on this Vercel site.

**Suggested fix.** Update to a supported patched Next.js release (at least the applicable 15.5.24 patch for the cited issue), refresh the lockfile/transitives, review every remaining advisory for reachability, and rebuild/test before deployment.

**Locations:** [package-lock.json:1](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/package-lock.json:1), [next.config.mjs:34](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/next.config.mjs:34).

**External support:** [Next.js AVIF advisory](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4).
## A08 · P2 · Long COVID p-value bounds are erased

**Area:** Science + code. **Status:** Confirmed.

**Evidence.** numericOrNull strips < and > before parsing. The eligible report 10.17816/rjpbr628759 has two outcome p-values "<0.05"; they become .05 and are counted as nonsignificant. Other records encode numeric thresholds plus p_value_exact=false, which is also discarded in the lean props. Formatting rounds values near .05 to .05, potentially contradicting the classification.

**Why it matters.** Outcome counts, primary badges and the blinding/significance chart can disagree with what the source reported.

**Suggested fix.** Preserve p-value operator/exactness as typed data. Decide significance from bounds only when logically possible, and format the original operator. Keep uncertain bounds unclassified.

**Locations:** [app/birds-eye-reviews/long-covid/page.tsx:88](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/birds-eye-reviews/long-covid/page.tsx:88), [app/birds-eye-reviews/long-covid/page.tsx:337](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/birds-eye-reviews/long-covid/page.tsx:337), [app/birds-eye-reviews/long-covid/LongCovidDashboard.tsx:43](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/birds-eye-reviews/long-covid/LongCovidDashboard.tsx:43).
## A09 · P2 · Several explanations equate nonsignificance with absence of an effect

**Area:** Science. **Status:** Confirmed.

**Evidence.** The replication-methods page says two nonsignificant studies agree there is no effect. The definitions page describes unsuccessful replications as evidence that an effect does not exist, although the statistical criterion labels p>=.05 a failure. The lithium report describes p=.16 as "nothing" and uses the statistically-null result to support a strong extrapolation to very low doses, despite explicitly lacking bridging data.

**Why it matters.** Readers can mistake low precision for equivalence or safety. The lithium CI shown on the page (−1.4 to +4.5 kg) is compatible with a range of effects; failure to reject zero alone does not establish a negligible effect.

**Suggested fix.** Describe the operational classification separately from evidence of absence. Use effect estimates and intervals; require prespecified equivalence bounds or another justified absence test for equivalence claims. Frame the low-dose lithium conclusion as unresolved by this corpus.

**Locations:** [content/docs/replication-outcome-classification.md:92](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/content/docs/replication-outcome-classification.md:92), [content/docs/defining-replication.md:27](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/content/docs/defining-replication.md:27), [app/birds-eye-reviews/lithium-weight-gain/report/page.tsx:167](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/birds-eye-reviews/lithium-weight-gain/report/page.tsx:167), [app/birds-eye-reviews/lithium-weight-gain/report/page.tsx:278](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/birds-eye-reviews/lithium-weight-gain/report/page.tsx:278).

**External support:** [Cochrane interpretation guidance](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-15), [Research on replication of null results](https://arxiv.org/abs/2305.04587).
## A10 · P1 · Forensic finding overstates what multiplicity and asymmetric intervals establish

**Area:** Science / public wording. **Status:** Confirmed.

**Evidence.** The CAPTAIN I entry calls fourteen uncorrected outcomes evidence for p-hacking, without presenting evidence of selective analysis or reporting in that summary. The same entry treats SMD or OR estimates not centered in confidence intervals as unusual. Ratio CIs are normally asymmetric on the raw scale, and SMD intervals need not be symmetric either.

**Why it matters.** The public summary draws stronger conclusions about a named study than the stated observations justify. The sitewide disclaimer does not correct an unsupported statistical inference.

**Suggested fix.** Replace the p-hacking wording with a precise multiplicity/false-positive-risk observation unless selective analysis is independently established. Recheck interval compatibility using the reported estimation method and appropriate scale. Do not revise or post external PubPeer comments as part of a website-only audit.

**Locations:** [app/forensic-metascience-agent/findings/findings.ts:219](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/forensic-metascience-agent/findings/findings.ts:219).

**External support:** [Cochrane effect measures and intervals](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-06).
## A11 · P2 · Effect-size documentation contains incorrect equivalences

**Area:** Science. **Status:** Confirmed.

**Evidence.** The partial-eta-squared section says numerator df=1 implies partial eta squared equals eta squared. A one-df effect in a multifactor model can still have different denominators. The Cramer V section writes V=phi=|r|, although signed phi can be negative; the correct identity is V=|phi|=|r| for 2×2 tables. Repeated 0–1 descriptions also obscure that signed replication r can be negative.

**Why it matters.** These are mathematical errors in the methodological reference, and may encourage treating partial/multiple association measures as ordinary bivariate Pearson correlations.

**Suggested fix.** State the correct design conditions for eta equality, preserve the signed/unsigned distinction, and separate exact conversions from approximations. Remove the guarantee that same-design inflation necessarily cancels across studies.

**Locations:** [content/docs/effect-size-normalization.md:186](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/content/docs/effect-size-normalization.md:186), [content/docs/effect-size-normalization.md:280](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/content/docs/effect-size-normalization.md:280), [content/docs/effect-size-normalization.md:33](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/content/docs/effect-size-normalization.md:33).

**External support:** [Lakens effect-size primer](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2013.00863/full).
## A12 · P2 · The WHO-definition filter checks only time since infection

**Area:** Science. **Status:** Confirmed.

**Evidence.** The dashboard labels min_weeks>=12 as "Meets WHO definition". It does not check symptom duration or exclusion of alternative explanations. Those are also part of the WHO clinical definition.

**Why it matters.** The UI overstates how specifically study eligibility was validated.

**Suggested fix.** Relabel as "Minimum time since infection ≥12 weeks" or implement and separately expose the full definition criteria, including unknowns.

**Locations:** [app/birds-eye-reviews/long-covid/LongCovidDashboard.tsx:128](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/birds-eye-reviews/long-covid/LongCovidDashboard.tsx:128), [app/birds-eye-reviews/long-covid/LongCovidDashboard.tsx:418](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/birds-eye-reviews/long-covid/LongCovidDashboard.tsx:418).

**External support:** [WHO clinical case definition](https://www.who.int/publications/i/item/WHO-2019-nCoV-Post_COVID-19_condition-Clinical_case_definition-2021.1).
## A13 · P2 · No significant network inconsistency tests are labeled "consistent"

**Area:** Science. **Status:** Confirmed.

**Evidence.** The network page appends "(consistent)" whenever n_significant===0. The current output is 0/8 tests. Nonsignificant, often low-powered inconsistency tests do not establish network coherence or transitivity.

**Why it matters.** The label conveys stronger validation than the test supports, particularly with sparse nodes and mixed populations already noted in the caveats.

**Suggested fix.** Use "No statistically detectable inconsistency in 8 tested comparisons" and retain the power/transitivity limitations.

**Locations:** [app/birds-eye-reviews/restless-legs-syndrome/network-meta-analysis/page.tsx:223](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/birds-eye-reviews/restless-legs-syndrome/network-meta-analysis/page.tsx:223).

**External support:** [Cochrane network meta-analysis](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-11).
## A14 · P2 · Pipeline evaluation reports coverage above 100%

**Area:** Science / reporting. **Status:** Confirmed.

**Evidence.** The original-p-value row reports coverage 102.3% (45/44). If coverage means the proportion of eligible ground-truth values extracted, the numerator cannot exceed the denominator. The percentage faithfully calculates 45/44; the underlying counts/definition are the problem.

**Why it matters.** The evaluation is internally inconsistent or uses an undocumented denominator. Readers cannot interpret the advertised extraction coverage.

**Suggested fix.** Reconcile matching/counting against the evaluation records. If 45 includes extra predictions, report those separately from ground-truth coverage. Do not simply clamp the percentage.

**Locations:** [content/docs/v6_pipeline_evaluation.md:35](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/content/docs/v6_pipeline_evaluation.md:35).
## A15 · P2 · Model A/B changes confound added p-values with a different sample

**Area:** Science / interpretation. **Status:** Confirmed.

**Evidence.** The discussion says p-value absorbs what prestige variables appeared to carry. Model A uses 6,306 rows, while Model B uses 453 complete cases with exact p-values. The code correctly computes each fit and the text acknowledges selection; however, the coefficient change does not isolate the effect of adding p.

**Why it matters.** Readers may infer statistical explanation/attenuation from a comparison whose sample also changes.

**Suggested fix.** Fit a no-p model on the same 453 rows as Model B before discussing absorption. Until then, state that the models are not a controlled nested comparison.

**Locations:** [app/replications-database/correlates-of-reproducibility/page.tsx:351](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/replications-database/correlates-of-reproducibility/page.tsx:351), [app/replications-database/correlates-of-reproducibility/stats.ts:208](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/replications-database/correlates-of-reproducibility/stats.ts:208).
## A16 · P2 · Bibliography output silently retains only the first effect per DOI

**Area:** Code + science. **Status:** Confirmed.

**Evidence.** After matching database rows, uniqueMatches keeps the first row for each original DOI and discards the others. Current DOI 10.1016/j.cognition.2014.09.006 has five rows: one success, three failures, one inconclusive. The output would retain only the first result once the filename bug is fixed.

**Why it matters.** A paper with mixed evidence can be presented as a single success. Multiple effect rows are legitimate and must not be deduplicated by original-paper DOI.

**Suggested fix.** Group matches by original DOI and show all effects/replication papers, or present an explicit aggregate with its rule and counts. Keep matchedDois as a separate count.

**Locations:** [app/api/upload-bibliography/route.ts:179](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/api/upload-bibliography/route.ts:179).
## A17 · P2 · Bibliography output turns missing numbers into zero and mislabels r

**Area:** Code + science. **Status:** Confirmed.

**Evidence.** Number("") returns zero. d3-dsv represents missing fields as empty strings, so the API emits zero effect sizes and zero N. The API also reads *_es_r but sends the raw *_es_type; the client formats the resulting value with that raw type. Thus a converted correlation may be displayed as Cohen d or OR. 7,009 current rows lack at least one normalized r field.

**Why it matters.** Missing evidence becomes an apparently measured null effect, and valid normalized values can be reported on the wrong scale. These bugs are masked by the current upload 500.

**Suggested fix.** Use the existing blank-safe number parser. Return r with an explicit r label, or return raw effect values with raw types; never mix them.

**Locations:** [app/api/upload-bibliography/route.ts:161](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/api/upload-bibliography/route.ts:161), [app/upload-bibliography/page.tsx:30](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/upload-bibliography/page.tsx:30).
## A18 · P2 · Citation HTML interpolates metadata without escaping

**Area:** Code / security. **Status:** Confirmed unsafe sink; exploitation not demonstrated.

**Evidence.** generateCitationHtml inserts author, journal and URL strings directly into HTML, and the database page passes that HTML to dangerouslySetInnerHTML. It neither escapes HTML/attribute characters nor restricts URL schemes. Data ingestion is a plausible trust boundary, but this review did not establish a malicious record or a public endpoint for writing these fields.

**Why it matters.** A compromised or malformed imported record could inject markup or script-capable content; legitimate markup characters can also break citation rendering.

**Suggested fix.** Render citation fields as React text and validated links. If HTML remains necessary, use context-appropriate escaping, an http/https allowlist, and sanitization at the rendering boundary.

**Locations:** [lib/citations.ts:36](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/lib/citations.ts:36), [app/replications-database/page.tsx:1121](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/replications-database/page.tsx:1121).
## A19 · P2 · The lint command does not run a configured linter

**Area:** Tooling. **Status:** Confirmed.

**Evidence.** npm run lint passes the tool-catalog check, then next lint asks interactively which ESLint configuration to create and exits unsuccessfully in this noninteractive run. package.json has no ESLint dev dependency/configuration in the checked setup. The build still compiles and type-checks.

**Why it matters.** The documented lint check is not a usable local/CI quality gate; a successful build should not be reported as an ESLint pass.

**Suggested fix.** Add a compatible explicit ESLint setup and noninteractive script; put required checks in CI. Add statistical edge-case tests, since the current tests missed the scientific defects.

**Locations:** [package.json:14](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/package.json:14).
## A20 · P2 · Long COVID references use given names in place of surnames

**Area:** Citations. **Status:** Confirmed.

**Evidence.** The shipped doi_metadata.json stores first_author values such as Linda and Tom, and the dashboard displays "Linda et al." and "Tom et al.". The latter paper is authored by Tom Farmen Nerli and should be cited using Nerli. Some nasal-spray forest labels also appear as "al. 2023", consistent with parsing an already abbreviated author string.

**Why it matters.** References are difficult to recognize and the presentation looks like faulty extraction even when the DOI is correct.

**Suggested fix.** Preserve structured family/given names from bibliographic metadata; avoid guessing surname by splitting free text. Add representative tests for initials, compound surnames, suffixes, non-Western names, and et al. strings.

**Locations:** [data/birds_eye_reviews/long_covid/doi_metadata.json:9](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/data/birds_eye_reviews/long_covid/doi_metadata.json:9), [app/birds-eye-reviews/long-covid/page.tsx:397](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/birds-eye-reviews/long-covid/page.tsx:397), [app/birds-eye-reviews/antiviral-nasal-sprays/meta-analysis/page.tsx:31](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/birds-eye-reviews/antiviral-nasal-sprays/meta-analysis/page.tsx:31).

**External support:** [Nerli primary report](https://pubmed.ncbi.nlm.nih.gov/39699896/).
## A21 · P2 · Promise score tooltip says 0–1 while values reach 3.5

**Area:** Scientific presentation. **Status:** Confirmed.

**Evidence.** The Promise Score heading tooltip describes a 0–1 score. Eligible source records range up to 3.46 and the default browser table renders 3.5. The table sorts by this score by default.

**Why it matters.** The range and meaning of the ranking are misstated; users cannot calibrate or interpret scores as described.

**Suggested fix.** Display the actual documented upstream scale and formula/version, or deliberately normalize with a defined mapping. Do not merely clamp values to 1.

**Locations:** [app/birds-eye-reviews/long-covid/LongCovidDashboard.tsx:1231](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/birds-eye-reviews/long-covid/LongCovidDashboard.tsx:1231), [app/birds-eye-reviews/long-covid/page.tsx:445](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/birds-eye-reviews/long-covid/page.tsx:445).
## A22 · P2 · RLS forest-plot labels become unreadable on mobile

**Area:** Usability. **Status:** Confirmed.

**Evidence.** At a 390px viewport, the 760-unit SVG shrinks into a roughly 300px plot container. Drug/CI labels use 10–11 SVG-unit fonts, yielding roughly 4px screen text. This was visible in the mobile browser screenshot. Expanding trials works through the visible label and produces no console error.

**Why it matters.** The scientific results cannot reasonably be read on a phone, even though the route loads and no horizontal overflow is reported.

**Suggested fix.** Use a responsive data table/compact layout, or a minimum-width chart inside a horizontally scrollable container. Maintain readable axis/CI labels and accessible equivalents.

**Locations:** [app/birds-eye-reviews/restless-legs-syndrome/meta-analysis/MetaAnalysisClientWrapper.tsx:74](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/birds-eye-reviews/restless-legs-syndrome/meta-analysis/MetaAnalysisClientWrapper.tsx:74), [app/birds-eye-reviews/restless-legs-syndrome/meta-analysis/MetaAnalysisClientWrapper.tsx:129](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/birds-eye-reviews/restless-legs-syndrome/meta-analysis/MetaAnalysisClientWrapper.tsx:129).
## A23 · P3 · Public copy has spelling/grammar errors and two broken anchors

**Area:** Copy + links. **Status:** Confirmed.

**Evidence.** Confirmed examples: "ancedtoal", "recieved", "Beal's list", "a documented phenomena", and the fragment beginning "Russian set of approved drugs ... different" in the Bird's Eye overview; "citaiton", "scienceometrics", and "an known issue" in the Explorer overview; "failures where were", "a small changes", and "those sort" in pipeline evaluation; "two group's means" in effect normalization; "Suspciously" and "unsignificant" in forensic findings. The rendered anchors #cohens-f2-f2 and #cramers-v do not exist; actual generated IDs are #cohens-f-f2 and #cramérs-v.

**Why it matters.** These visible errors reduce readability and credibility. The two links fail to navigate to the intended sections.

**Suggested fix.** Use anecdotal, received, Beall's List, a documented phenomenon, citation, scientometrics, a known issue, failures were cases where, small changes, those sorts, two groups' means, suspiciously, and nonsignificant. Rewrite the Russian-drug sentence as a full sentence. Define stable explicit heading IDs or generate the table of contents from headings.

**Locations:** [content/docs/birds-eye-reviews.md:17](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/content/docs/birds-eye-reviews.md:17), [content/docs/overview-explorer.md:5](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/content/docs/overview-explorer.md:5), [content/docs/v6_pipeline_evaluation.md:11](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/content/docs/v6_pipeline_evaluation.md:11), [content/docs/effect-size-normalization.md:41](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/content/docs/effect-size-normalization.md:41), [app/forensic-metascience-agent/findings/findings.ts:104](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/forensic-metascience-agent/findings/findings.ts:104).
## A24 · P3 · Some server-rendered page responses are very large

**Area:** Performance. **Status:** Measured payload; user-visible latency not quantified.

**Evidence.** The local production HTTP crawl measured uncompressed HTML of 6,070,209 bytes for Long COVID, 3,035,015 for impact factor, and 1,913,708 for RLS. These are decoded response sizes, not compressed wire sizes or Core Web Vitals measurements.

**Why it matters.** Large embedded React/data payloads add parsing and memory costs, especially on mobile. This is a measured optimization opportunity, not a proven latency regression.

**Suggested fix.** Profile compressed transfer, hydration and interaction on a representative device. Load trial details on demand, paginate server-side where appropriate, and avoid duplicating large data structures in the initial payload.

**Locations:** [app/birds-eye-reviews/long-covid/page.tsx:299](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/birds-eye-reviews/long-covid/page.tsx:299), [app/replications-database/by-impact-factor/page.tsx:1](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/replications-database/by-impact-factor/page.tsx:1).
## A25 · P2 · Review coverage and novelty claims exceed demonstrated evidence

**Area:** Science / scope claims. **Status:** Unsupported/generalized claims; exhaustive literature review not performed.

**Evidence.** The Bird's Eye overview says users receive data on all papers, that no interface previously enabled this, and that reviews/meta-analyses up until now focused on English alone. The same document later describes attempting to include as many non-English studies as possible. The lithium report says dose dependence has never actually been measured, although the demonstrated result is limited to this automated corpus and its extractable variables.

**Why it matters.** An incomplete retrieval/extraction pipeline cannot establish exhaustive literature coverage or a universal negative about prior research. These claims are not substantiated by the audit trail presented on the site.

**Suggested fix.** Use "identified papers in our current search", specify databases/languages/search dates/coverage limits, and narrow novelty claims to demonstrated features. Say "we did not identify a usable dose-response comparison in this corpus" unless a dedicated review supports the universal claim.

**Locations:** [content/docs/birds-eye-reviews.md:5](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/content/docs/birds-eye-reviews.md:5), [content/docs/birds-eye-reviews.md:31](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/content/docs/birds-eye-reviews.md:31), [app/birds-eye-reviews/lithium-weight-gain/report/page.tsx:149](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/app/birds-eye-reviews/lithium-weight-gain/report/page.tsx:149).

## Additional boundaries and follow-up

The shared CI metric guard also accepts entire families as interchangeable (for example OR/RR and r/kappa). That is not a sound guarantee of equal measurement scale, but current differing-label CI rows in this checkout were only d/g pairs; it is recorded here as a latent design concern rather than a demonstrated additional current-data error.

Do not deduplicate replication rows by DOI pairs or descriptions. This audit treated the main CSV as effect-level data and the clinical-review duplicate example as two reports of the same registered trial; those are distinct problems.

The current reported-result headline is 4,158 / (4,158 + 3,107 + 117) = 56.33%. The methods page's 55.5% example explicitly identifies its July data release, so it was not treated as an undisclosed wrong current headline.

The local Long COVID meta_analysis.json contains additional potentially problematic pools, but the treatment page reviewed here does not consume that file. They were not counted as displayed website findings.

Recommended order: suspend/rebuild the suspect RLS pairwise results; fix measure-aware direction and p-value handling; link clinical companion reports; patch dependencies and repair bibliography output; correct overstatements and methods; finish copy, references and mobile readability.

## Evidence files

- [Machine-readable findings](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/docs/audits/2026-09-18/findings.json)
- [Baseline-match audit queue](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/docs/audits/2026-09-18/baseline-matches.json)
- [Route status/payload checks](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/docs/audits/2026-09-18/route-checks.json)
- [Dependency audit](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/docs/audits/2026-09-18/dependency-audit.json)
- [Python regression cross-check](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/docs/audits/2026-09-18/regression-python.txt)
- [TypeScript regression cross-check](/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/docs/audits/2026-09-18/regression-typescript.txt)
