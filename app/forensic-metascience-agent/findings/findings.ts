// Findings from the Forensic Metascience Agent, transcribed from the internal
// PubPeer-submission tracking document. Citation metadata (authors, volume,
// issue, pages) standardized against Crossref. This file is the source of
// truth going forward — add new findings here.

export type FindingStatus = "posted" | "not_reported" | "no_issues" | "retracted";

export interface Finding {
  title: string;
  /** Standardized: up to three "Family GI" names, then "et al." */
  authors: string;
  journal: string;
  volume?: string;
  issue?: string;
  /** Page range or article number. */
  pages?: string;
  year: number;
  /** Bare DOI, e.g. "10.1007/s00702-004-0248-2". */
  doi: string;
  /** Neutral-language description of what the agent found (after human review). */
  summary: string;
  status: FindingStatus;
  /** Canonical PubPeer thread URL, anchored to our comment (posted entries only). */
  pubpeerUrl?: string;
  submitted?: string;
  /** Date the agent's analysis run completed (from the run metadata). */
  analyzed?: string;
  /** Pipeline configuration used for the run (mode and model, from run_meta.json). */
}

export const postedFindings: Finding[] = [
  {
    title: "Memories of unethical actions become obfuscated over time",
    authors: "Kouchaki M, Gino F",
    journal: "Proceedings of the National Academy of Sciences",
    volume: "113",
    issue: "22",
    pages: "6166–6171",
    year: 2016,
    doi: "10.1073/pnas.1523586113",
    summary: "Eight duplicated numbers in the supplementary information.",
    status: "posted",
    pubpeerUrl: "https://pubpeer.com/publications/D4AD3603799057B49D9B05C0A6CC42#2",
    submitted: "August 10, 2026"
  },
  {
    title:
      "Influence of Exogenous Neuropeptides on the Astrocyte Response Under Conditions of Continuous and Cyclic Hypoxia and Red Blood Cell Lysate",
    authors: "Kojder K, Gąssowska-Dobrowolska M, Żwierełło W, et al.",
    journal: "International Journal of Molecular Sciences",
    volume: "26",
    issue: "9",
    pages: "3953",
    year: 2025,
    doi: "10.3390/ijms26093953",
    summary:
      "A duplicated figure, and three direct contradictions between statements in the abstract and the data presented in the paper.",
    status: "posted",
    pubpeerUrl: "https://pubpeer.com/publications/0AC0A5CF9362B73D4CBD1C32555D60#1",
    submitted: "August 14, 2026",
  },
  {
    title:
      "Neuroprotective treatment with Cerebrolysin in patients with acute stroke: a randomised controlled trial",
    authors: "Ladurner G, Kalvach P, Moessler H, and the Cerebrolysin Study Group",
    journal: "Journal of Neural Transmission",
    volume: "112",
    issue: "3",
    pages: "415–428",
    year: 2005,
    doi: "10.1007/s00702-004-0248-2",
    summary:
      "Two drop-outs unaccounted for, and three issues with the calculation of adverse event rates.",
    status: "posted",
    pubpeerUrl: "https://pubpeer.com/publications/80B81EA343DC9790525C8C4C99DCB6#1",
    submitted: "August 16, 2026",
  },
  {
    title:
      "Therapeutic effects of cerebrolysin added to risperidone in patients with schizophrenia dominated by negative symptoms",
    authors: "Xiao S, Xue H, Li G, et al.",
    journal: "Australian & New Zealand Journal of Psychiatry",
    volume: "46",
    issue: "2",
    pages: "153–160",
    year: 2012,
    doi: "10.1177/0004867411433213",
    summary: "Two patients unaccounted for.",
    status: "posted",
    pubpeerUrl: "https://pubpeer.com/publications/7ED5F6763F122CFC44672AA2435D93#1",
    submitted: "August 16, 2026",
  },
  {
    title:
      "Treatment with Cerebrolysin Prolongs Lifespan in a Mouse Model of Cerebral Autosomal Dominant Arteriopathy with Subcortical Infarcts and Leukoencephalopathy",
    authors: "Kastberger B, Winter S, Brandstätter H, et al.",
    journal: "Advanced Biology",
    volume: "8",
    issue: "2",
    pages: "2300439",
    year: 2024,
    doi: "10.1002/adbi.202300439",
    summary:
      "Unjustified use of a one-tailed test in place of the standard two-tailed test flips a headline finding from statistically significant to unsignificant (p=0.092).",
    status: "posted",
    pubpeerUrl: "https://pubpeer.com/publications/8C8CCFA71C47A79F8921F3483FF9F7#1",
    submitted: "August 16, 2026",
  },
];

export const otherFindings: Finding[] = [
  {
    title:
      "Stress-associated ovarian damage, infertility, and delay in achieving pregnancy and treatment options",
    authors: "Aynaoglu Yildiz G, Yapca OE, Dinc K, et al.",
    journal: "Investigación Clínica",
    volume: "64",
    issue: "4",
    pages: "513–523",
    year: 2023,
    doi: "10.54817/IC.v64n4a08",
    summary:
      "The counts of fertile and non-fertile rats in Table 1 are contradicted in the text (a discrepancy of 2 out of 8).",
    status: "not_reported",
  },
  {
    title:
      "Neurophysiological indices of CNS plasticity in the course of treatment of head trauma in adolescents",
    authors: "Iznak AF, Iznak EV, Zavadenko NN, et al.",
    journal: "Human Physiology",
    volume: "34",
    issue: "6",
    pages: "672–677",
    year: 2008,
    doi: "10.1134/s0362119708060030",
    summary:
      "A discrepancy in terminology: the abstract states the main treatment group consisted of 30 adolescents with “severe” head trauma, but Table 1 shows 9 with “severe” and 21 with “moderate” head trauma.",
    status: "not_reported",
  },
  {
    title:
      "Comparative neuroprotective effects of Cerebrolysin, dexamethasone, and ascorbic acid on sciatic nerve injury model: Behavioral and histopathological study",
    authors: "Elhessy HM, Habotta OA, Eldesoqui M, et al.",
    journal: "Frontiers in Neuroanatomy",
    volume: "17",
    pages: "1090738",
    year: 2023,
    doi: "10.3389/fnana.2023.1090738",
    summary:
      "Two impossibly large standard deviations in Table 2, most likely a missing leading decimal point, plus two minor deviations from the stated analysis plan.",
    status: "not_reported",
  },
  {
    title:
      "Superior Neuroprotective Effects of Cerebrolysin in Heat Stroke Following Chronic Intoxication of Cu or Ag Engineered Nanoparticles",
    authors: "Sharma HS, Muresanu DF, Patnaik R, et al.",
    journal: "Journal of Nanoscience and Nanotechnology",
    volume: "11",
    issue: "9",
    pages: "7549–7569",
    year: 2011,
    doi: "10.1166/jnn.2011.5114",
    summary:
      "p-values reported only as thresholds (“<”) or not reported at all. Suspciously small p-values under re-calculation. (would require further forensic analysis before a PubPeer comment)",
    status: "not_reported",
  },
  {
    title:
      "Efficacy and safety of Cerebrolysin in moderate to moderately severe Alzheimer’s disease: results of a randomized, double-blind, controlled trial investigating three dosages of Cerebrolysin",
    authors: "Alvarez XA, Cacabelos R, Sampedro C, et al.",
    journal: "European Journal of Neurology",
    volume: "18",
    issue: "1",
    pages: "59–68",
    year: 2011,
    doi: "10.1111/j.1468-1331.2010.03092.x",
    summary:
      "Three p-values inconsistent with their 95% confidence intervals. None changes the direction of significance; all three make non-significant values more non-significant.",
    status: "not_reported",
  },
  {
    title:
      "Subchronic cerebrolysin treatment alleviates cognitive impairments and dendritic arborization alterations of granular neurons in the hippocampal dentate gyrus of rats with temporal lobe epilepsy",
    authors: "Zamudio SR, Pichardo-Macías LA, Díaz-Villegas V, et al.",
    journal: "Epilepsy & Behavior",
    volume: "97",
    pages: "96–104",
    year: 2019,
    doi: "10.1016/j.yebeh.2019.05.025",
    summary: "No problems found.",
    status: "no_issues",
  },
  {
    title:
      "Safety and efficacy of Cerebrolysin in acute brain injury and neurorecovery: CAPTAIN I — a randomized, placebo-controlled, double-blind, Asian-Pacific trial",
    authors: "Poon W, Matula C, Vos PE, et al.",
    journal: "Neurological Sciences",
    volume: "41",
    issue: "2",
    pages: "281–293",
    year: 2020,
    doi: "10.1007/s10072-019-04053-5",
    summary:
      "Several brain-injury severity scores fall outside the range reported elsewhere in the paper, creating a contradiction. Fourteen outcomes were tested with no multiple-comparison correction — evidence for p-hacking. Six SMD or OR values are not centered within their confidence intervals, which is unusual but may have an innocent explanation.",
    status: "not_reported",
  },
  {
    title:
      "Ameliorative influence of a nootropic drug on motor activity of rats after bilateral carotid artery occlusion",
    authors: "Gschanes A, Valoušková V, Windisch M",
    journal: "Journal of Neural Transmission",
    volume: "104",
    issue: "11–12",
    pages: "1319–1327",
    year: 1997,
    doi: "10.1007/bf01294733",
    summary:
      "Four p-value recalculation discrepancies, all off by a small amount; none changes significance or the direction of any effect.",
    status: "not_reported",
  },
  {
    title:
      "Design and synthesis of nano-biomaterials based on graphene and local delivery of cerebrolysin into the injured spinal cord of mice, promising neural restoration",
    authors: "Yari-Ilkhchi A, Mahkam M, Ebrahimi-Kalan A, et al.",
    journal: "Nanoscale Advances",
    volume: "6",
    issue: "3",
    pages: "990–1000",
    year: 2024,
    doi: "10.1039/d3na00760j",
    summary:
      "Many p-values come out much smaller when recalculated, apparently because of unusually small reported standard deviations — possibly a unit-conversion issue in how they report their SDs. (Disentangling if there is actually a serious issue here would take further work.)",
    status: "not_reported",
  },
  {
    title:
      "Cerebrolysin enhances neurogenesis in the ischemic brain and improves functional outcome after stroke",
    authors: "Zhang C, Chopp M, Cui Y, et al.",
    journal: "Journal of Neuroscience Research",
    volume: "88",
    issue: "15",
    pages: "3275–3281",
    year: 2010,
    doi: "10.1002/jnr.22495",
    summary:
      "Values labeled as standard errors appear to actually be standard deviations; possible under-dispersion in the baseline table (Table 1).",
    status: "not_reported",
  },
  {
    title:
      "Cerebrolysin Attenuates Exacerbation of Neuropathic Pain, Blood-spinal Cord Barrier Breakdown and Cord Pathology Following Chronic Intoxication of Engineered Ag, Cu or Al (50–60 nm) Nanoparticles",
    authors: "Sharma HS, Feng L, Chen L, et al.",
    journal: "Neurochemical Research",
    volume: "48",
    issue: "6",
    pages: "1864–1888",
    year: 2023,
    doi: "10.1007/s11064-023-03861-8",
    summary:
      "Numerous statistical inconsistencies; not written up because the paper had already been retracted for other reasons.",
    status: "retracted",
  },
  {
    title:
      "Neuropeptide Treatment with Cerebrolysin Enhances the Survival of Grafted Neural Stem Cell in an α-Synuclein Transgenic Model of Parkinson’s Disease",
    authors: "Rockenstein E, Desplats P, Ubhi K, et al.",
    journal: "Journal of Experimental Neuroscience",
    volume: "9",
    issue: "Suppl 2",
    year: 2015,
    doi: "10.4137/JEN.S25521",
    summary:
      "A very large number of statistical errors and issues with the statistical procedures, a few of which change subsidiary findings. (A PubPeer comment would require additional time on our end we don't currently have.)",
    status: "not_reported",
  },
  {
    title:
      "Cerebrolysin and Recovery After Stroke (CARS): A Randomized, Placebo-Controlled, Double-Blind, Multicenter Trial",
    authors: "Muresanu DF, Heiss WD, Hoemberg V, et al.",
    journal: "Stroke",
    volume: "47",
    issue: "1",
    pages: "151–159",
    year: 2016,
    doi: "10.1161/STROKEAHA.115.009416",
    summary:
      "The abstract states a premature-discontinuation rate of 3.8% (8 of 208), while the body of the paper reports 12 premature discontinuations (5.7%). Also: mishandling of deceased placebo-group patients in the disability-score calculation, a minor calculation issue in smoking prevalence, a slight contradiction in average stroke-severity score between the results and discussion sections, missing confidence intervals on important numbers, and the same earlier study described twice with two different sizes (252 patients in the introduction, 246 in the discussion).",
    status: "not_reported",
  },
  {
    title:
      "Timed Release of Cerebrolysin Using Drug-Loaded Titanate Nanospheres Reduces Brain Pathology and Improves Behavioral Functions in Parkinson’s Disease",
    authors: "Ozkizilcik A, Sharma A, Muresanu DF, et al.",
    journal: "Molecular Neurobiology",
    volume: "55",
    issue: "1",
    pages: "359–369",
    year: 2018,
    doi: "10.1007/s12035-017-0747-4",
    summary:
      "Numerous statistical issues and contradictions; not written up because the paper had already been retracted for other reasons.",
    status: "retracted",
  },
  {
    title:
      "Suicide Ideation, Plans, and Attempts Among Military Veterans vs Nonveterans With Disability",
    authors: "Blais RK, Xie Z, Kirby AV, et al.",
    journal: "JAMA Network Open",
    volume: "6",
    issue: "10",
    pages: "e2337679",
    year: 2023,
    doi: "10.1001/jamanetworkopen.2023.37679",
    summary:
      "The arithmetic is clean, but the headline protective-effect conclusion rests on 3 of 15 veteran-vs-nonveteran subgroup contrasts reaching significance (six point the opposite direction), the disability-by-veteran interaction the Methods describe fitting is never reported, and one Table 3 marginal effect is inconsistent with its own confidence interval and p-value.",
    status: "not_reported",
    analyzed: "July 27, 2026",
  },
  {
    title:
      "Early Home Visits and Health Outcomes in Low-Income Mothers and Offspring: 18-Year Follow-Up of a Randomized Clinical Trial",
    authors: "Conti G, Smith J, Anson E, et al.",
    journal: "JAMA Network Open",
    volume: "7",
    issue: "1",
    pages: "e2351752",
    year: 2024,
    doi: "10.1001/jamanetworkopen.2023.51752",
    summary:
      "The four significant female-offspring effects in Table 1 — including the abstract's headline P < .001 result — have p-values that reconcile with the printed 95% confidence intervals only if those are actually 99% intervals, alongside a “correlation coefficient” of 11.3 (likely 0.113) and a percentage (98.8%) that is impossible at its stated denominator of 618.",
    status: "not_reported",
    analyzed: "July 27, 2026",
  },
  {
    title:
      "Associations between inclusive community coalition leadership and use of evidence-based practices",
    authors: "Wells R, Ranjit N, Brown LD, et al.",
    journal: "American Journal of Community Psychology",
    volume: "77",
    issue: "3–4",
    pages: "590–601",
    year: 2026,
    doi: "10.1002/ajcp.70049",
    summary:
      "The lead predictor's response scale is stated two mutually exclusive ways (1–4 in the Methods vs “1.25–5” in the Results), the results tables label regression coefficients and standard errors as “M (SD)”, one row prints three different p-values (one as “0”) for an identical coefficient and standard error, and the randomized treatment-assignment covariate said to be in every model appears in no table.",
    status: "not_reported",
    analyzed: "July 27, 2026",
  },
  {
    title:
      "Momentary Mediational Associations Among Affect, Emotion Dysregulation, and Different Types of Loss of Control Eating Among Adults With Binge Eating Disorder",
    authors: "Romano KA, Peterson CB, Forester G, et al.",
    journal: "International Journal of Eating Disorders",
    volume: "58",
    issue: "6",
    pages: "1072–1084",
    year: 2025,
    doi: "10.1002/eat.24415",
    summary:
      "The repeated claim that positive affect played no role sits alongside data in Table 2 which appears to contradict that claim. Slight issues with rounding of averages.",
    status: "not_reported",
    analyzed: "July 27, 2026",
  },
];
