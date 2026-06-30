# Network meta-analysis — Restless Legs Syndrome (IRLS symptom severity)

> **Automated** network meta-analysis generated from this project's machine-extracted trial data. It reproduces the design of the published Zhou et al. 2021 RLS NMA (Front. Neurosci. 15:751643) as a validation target, but is **not** a substitute for a hand-curated review — see Caveats.

## Methods

- **Estimand:** mean difference in IRLS (0-40), lower = better vs **placebo** (negative = symptom improvement).
- **Model:** random-effects (DL), frequentist graph-theoretic NMA via **R netmeta 3.6.1**.
- **Inclusion:** randomized designs only (RCT / crossover / factorial / cluster); a single IRLS 0–40 scale (abbreviated 6-item, RLS-6, VAS and other scales excluded so the mean-difference network stays on one scale).
- **Treatment nodes:** canonical compound (formulations/brands merged; all control arms collapsed to a single placebo node). Analysis restricted to the placebo-anchored connected component.

## The network

- **102 studies**, **67 treatments**, 119 pairwise contrasts.
- Heterogeneity: τ = 1.646 (τ² = 2.708), I² = 59.9%.
- Inconsistency (node-splitting): 0 of 8 testable comparisons significant at p<0.05 (min p = 0.2023). No material inconsistency detected.

![Network](nma_network.png)

## Treatment ranking — core drugs (≥2 trials)

P-score is the frequentist analogue of SUCRA (higher = better; 0–1).

| Treatment | Trials | MD vs placebo (95% CI) | P-score | Zhou MD | Direction |
|---|---:|---|---:|---:|---|
| cabergoline | 2 | -11.99 (-16.82, -7.15) | 0.88 | -11.98 | significant ✓ matches |
| ferrous sulfate | 2 | -7.96 (-12.70, -3.23) | 0.69 | — | significant ✓ matches |
| dipyridamole | 2 | -7.27 (-9.95, -4.59) | 0.65 | — | significant  |
| pramipexole | 13 | -6.52 (-7.90, -5.14) | 0.60 | — | significant ✓ matches |
| gabapentin | 3 | -6.62 (-11.40, -1.84) | 0.59 | — | significant ✓ matches |
| gabapentin enacarbil | 8 | -5.97 (-7.43, -4.52) | 0.55 | -3.69 | significant ✓ matches |
| iron sucrose | 2 | -6.00 (-9.09, -2.90) | 0.55 | — | significant ✓ matches |
| levodopa/benserazide | 2 | -4.52 (-8.81, -0.23) | 0.43 | — | significant ✓ matches |
| pregabalin | 2 | -4.44 (-6.36, -2.53) | 0.41 | -5.34 | significant ✓ matches |
| rotigotine | 10 | -4.44 (-5.91, -2.97) | 0.41 | — | significant ✓ matches |
| ferric carboxymaltose | 3 | -3.77 (-6.26, -1.28) | 0.36 | — | significant ✓ matches |
| ropinirole | 6 | -3.66 (-5.07, -2.26) | 0.34 | -2.50 | significant ✓ matches |
| aerobic exercise | 2 | 6.33 (-2.77, 15.43) | 0.04 | — | ns  |

## Automated validation vs Zhou et al. 2021

Key published findings and whether our automated NMA reproduces them (directions, not exact values — our corpus is broader and machine-extracted):

- ✅ **Cabergoline largest effect (Zhou MD −11.98)** — our MD -11.99.
- ✅ **Pramipexole superior to ropinirole (Zhou MD −2.52)** — our MD difference -2.86.
- ⚠️ **Levodopa NOT significantly better than placebo** — our CI excludes 0.

## Single-trial treatments (low evidence — interpret with caution)

These rank highly on P-score but rest on **one small trial each**; they are shown for completeness, not as recommendations.

| Treatment | MD vs placebo (95% CI) | P-score |
|---|---|---:|
| cool dialysate hemodialysis | -17.11 (-21.20, -13.02) | 0.98 |
| high-frequency repetitive transcranial magnetic stimulation | -15.90 (-21.04, -10.76) | 0.97 |
| foot reflexology massage | -12.66 (-16.54, -8.78) | 0.91 |
| suvorexant | -12.70 (-17.25, -8.15) | 0.91 |
| effleurage massage with lavender essential oil | -10.82 (-14.95, -6.70) | 0.85 |
| pergolide | -10.40 (-15.14, -5.66) | 0.82 |
| mindfulness-based stress reduction | -9.37 (-13.30, -5.44) | 0.78 |
| lisuride | -11.70 (-24.93, 1.53) | 0.77 |

## Forest plot (vs placebo)

![Forest](nma_forest.png)

## Caveats

- **Automated extraction.** Effect signs, SDs (often derived from SE/CI), arm drug identity, and timepoint selection were machine-extracted; NMA propagates such errors through indirect links. The Zhou cross-check + head-to-head spot-checks are the guardrail.
- **Heterogeneity** is high (I² = 59.9%): a broad 2004–present pull mixes severities, primary/secondary RLS, doses, and trial lengths — transitivity is weaker than the tightly-curated Zhou review.
- **Scale & basis.** One IRLS 0–40 scale only; endpoint scores preferred over change-from-baseline where both exist; crossover trials handled approximately; non-randomized designs excluded.
- **Sparse nodes.** Most compounds have a single trial; the credible signal is the ≥2-trial core above. Single-trial nodes can top the ranking on thin evidence.
