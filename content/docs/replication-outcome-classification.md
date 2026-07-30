# Mathematical Methods for Classifying Replication Outcomes

The Replications Database provides four definitions of replication success: the outcome **as recorded in the database** (the `result` column), plus three statistical methods computed from the effect sizes. All three statistical methods operate on effect sizes that have been converted to Pearson's $r$ (see [Effect Size Normalization](/docs/effect-size-normalization)).

| Method | Question Asked |
|--------|----------------|
| [Reported result](#how-the-replication-rate-is-computed) | What outcome did the replication authors (or our extraction) record? |
| [Statistically Significant Effect in the Same Direction?](#statistically-significant-effect-in-the-same-direction) | Is the replication effect statistically significant in the same direction as the original? |
| [Original Effect Size in Replication 95% CI](#original-effect-size-in-replication-95-confidence-interval) | Does the original effect size fall within the replication's 95% confidence interval? |
| [Replication Effect Size in Original 95% CI](#replication-effect-size-in-original-95-confidence-interval) | Does the replication effect size fall within the original's 95% confidence interval? |

---

## How the Replication Rate Is Computed

Every method above sorts a replication into one of four outcomes: **success**, **failure**, **reversal**, or **inconclusive**. Turning those four buckets into a single percentage requires two further choices — what goes in the denominator, and what counts as one observation. Those choices move the headline number by more than any of the statistical methods do, so both are fixed site-wide and stated on every page that shows a rate.

### The definition

$$\text{replication rate} = \frac{\text{success}}{\text{success} + \text{failure} + \text{reversal}}$$

Two decisions are embedded here:

**A reversal counts as a failure.** A reversal is a statistically significant effect in the *opposite* direction from the original. That is a determinate result, not an absence of one — the replication did not fail to inform us, it contradicted the original. Excluding reversals would let the most decisive contradictions quietly leave the denominator.

**Inconclusive results are excluded, not counted as failures.** "We could not tell" is a different finding from "it did not replicate," and a replication that lacks the statistics needed to classify it says nothing about the original's robustness. Counting these as failures would confound missing data with negative evidence. Rows with no recorded outcome at all are excluded on the same grounds.

### The unit of analysis

The site-wide headline counts one **replication effect** — one row of the database — as one observation. This is the simplest unit to describe, and it introduces no threshold parameter that would need defending.

Some pages also offer a **paper-level** view, which groups a paper's effect replications by the original study and asks whether at least a given share of them succeeded (75% by default). This answers a different question — "what fraction of *papers* hold up?" rather than "what fraction of *findings* hold up?" — and it weights a paper with one replicated effect equally with a paper with twenty. Where a page shows a paper-level rate, it says so and states the threshold.

Note that the effect-level rate gives more weight to heavily-replicated papers, and the paper-level rate gives more weight to lightly-replicated ones. Neither is "correct"; they answer different questions.

### Coverage filters

Several pages restrict the denominator further — to originals with a recorded publication year, or a $p$-value below 0.05, or a match in an external citation, h-index, or journal-metric dataset. Those restrictions change the rate, sometimes by several points, purely by changing which studies are in scope. Each page states its filter and its denominator alongside the rate for exactly this reason.

### Sensitivity of the headline number

The choices above are defensible but not unique, and it is more honest to publish the range than to publish one number. Under the reported-result definition, the effect-level and paper-level rates span roughly **46% to 64%**:

| Definition | Rate |
|---|---|
| Success / all rows, including those with no recorded outcome | 46.2% |
| Success / all recorded outcomes (inconclusive in the denominator) | 47.0% |
| **Success / (success + failure + reversal)** — the site-wide definition | **55.5%** |
| Success / (success + failure), reversals dropped | 56.6% |
| Paper level, every effect must succeed | 56.8% |
| Paper level, ≥75% of effects succeed | 57.5% |
| Paper level, ≥50% of effects succeed | 61.8% |
| Paper level, any one success counts | 63.8% |

<small>Computed from `replications_database_2026_07_28_211702.csv` (8,598 rows: 3,976 success, 3,053 failure, 134 reversal, 1,435 inconclusive or unrecorded). These figures shift by a fraction of a point with each database release; the ordering and the width of the range do not.</small>

The spread is driven almost entirely by the treatment of the ~1,400 inconclusive and unrecorded rows and by the unit of analysis — not by disagreement about individual studies. A reader who wants a one-sentence summary is better served by "somewhere between 46% and 64% depending on how you count, and 55.5% under our stated definition" than by any single figure quoted without its rule.

These figures use the reported-result definition. The three statistical methods apply to the subset of rows carrying the necessary statistics and give their own rates, shown on the main database page.

---

## Statistically Significant Effect in the Same Direction?

This method evaluates whether the replication study achieves a statistically significant result in the same direction as the original study.

### Rationale

The simplest criterion for replication success: if the original study found a significant effect in one direction, a successful replication should also find a significant effect in that same direction. When the original study was not significant, the method checks whether the replication agrees (also non-significant) or disagrees (significant).

### Algorithm

This method is inspired by the [FReD R package](https://github.com/forrtproject/FReD) (`criterion = "significance_r"`), with modifications to handle non-significant originals and to prefer reported $p$-values over computed ones.

**Step 1: Determine $p$-Values**

For both the original and replication studies, the $p$-value is determined using this priority:

1. **Use the reported $p$-value** from the database (`original_p_value` or `replication_p_value`) if available
2. **Otherwise, compute** the $p$-value from the normalized Pearson $r$ and sample size $n$:

$$t = r \cdot \sqrt{\frac{n - 2}{1 - r^2}}$$

Compute the two-tailed $p$-value with $df = n - 2$ degrees of freedom.

Reported $p$-values are preferred because the conversion from other effect size types (Cohen's $d$, eta-squared, etc.) to Pearson $r$ introduces error, especially with small samples. This can cause computed $p$-values to disagree with reported ones on significance in approximately 10% of cases.

**Step 2: Check if the Original Study Was Significant**

If $p_O \geq 0.05$, the original was not significant. In this case, we check whether the replication agrees:

- If the replication is also not significant ($p_R \geq 0.05$): both studies agree there is no effect → **Success**
- If the replication is significant ($p_R < 0.05$): the studies disagree → **Failure**

**Step 3: If the Original Was Significant, Test the Replication**

If the original was significant ($p_O < 0.05$), check the replication's significance and direction consistency:

- **Same direction**: $\text{sign}(r_O) = \text{sign}(r_R)$
- **Opposite direction**: $\text{sign}(r_O) \neq \text{sign}(r_R)$

### Classification

| Condition | Outcome |
|-----------|---------|
| Original not significant ($p_O \geq 0.05$), replication also not significant ($p_R \geq 0.05$) | **Success** |
| Original not significant ($p_O \geq 0.05$), replication significant ($p_R < 0.05$) | **Failure** |
| Original significant, replication significant ($p_R < 0.05$) with same direction  | **Success** |
| Original significant, replication significant ($p_R < 0.05$) with opposite direction | **Reversal** |
| Original significant, replication not significant ($p_R \geq 0.05$) | **Failure** |

---

## Original Effect Size in Replication 95% Confidence Interval

This method checks whether the original effect size is a plausible value given the replication results, by testing if it falls within the replication's confidence interval.

### Rationale

If the original finding is "true," we would expect the original effect size to be consistent with the replication's estimate. This is operationalized by checking whether the original effect falls within the 95% confidence interval of the replication effect.

This method is implemented consistently with the [FReD R package](https://github.com/forrtproject/FReD) (`criterion = "consistency_ci"`).

### Confidence Interval Source

The method uses a two-strategy approach to maximize compatibility with original papers:

**Strategy 1 (Primary): Pre-computed CI with Raw Effect Sizes**

If the database contains a pre-computed 95% CI for the replication effect size (in the `replication_es_95_CI` column), this CI is compared against the **raw original effect size** (`original_es`). This matches the methodology used in original replication studies, where effect sizes and CIs are in their native units (Cohen's d, Hazard Ratio, etc.).

**Strategy 2 (Fallback): Computed CI with Normalized Effect Sizes**

If no pre-computed CI is available, the CI is computed using the Fisher $z$-transformation method from the normalized Pearson's $r$ values and sample sizes (see [Computing Confidence Intervals](#computing-confidence-intervals-fisher-z-transformation)).

### Classification

| Condition | Outcome |
|-----------|---------|
| Original ES within replication 95% CI | **Success** |
| Original ES outside replication 95% CI | **Failure** |
| Cannot obtain CI (missing data) | **Inconclusive** |

### Advantages

- Accounts for uncertainty in the replication estimate
- Does not require significance in either study
- Provides a more nuanced assessment than simple significance testing
- Effect size magnitude matters, not just statistical significance
- When pre-computed CIs are available, results match original paper methodology

---

## Replication Effect Size in Original 95% Confidence Interval

This method checks whether the replication effect size is a plausible value given the original results, by testing if it falls within the original's confidence interval.

### Rationale

This is the "mirror" of the previous method. If the replication is measuring the same underlying effect, we would expect the replication effect size to be consistent with the original's estimate. This is operationalized by checking whether the replication effect falls within the 95% confidence interval of the original effect.

This method is particularly useful when the original study had a larger sample size than the replication, giving it a narrower confidence interval.

### Confidence Interval Source

The method uses a two-strategy approach to maximize compatibility with original papers:

**Strategy 1 (Primary): Pre-computed CI with Raw Effect Sizes**

If the database contains a pre-computed 95% CI for the original effect size (in the `original_es_95_CI` column), this CI is compared against the **raw replication effect size** (`replication_es`). This matches the methodology used in original replication studies, where effect sizes and CIs are in their native units (Cohen's d, Hazard Ratio, etc.).

**Strategy 2 (Fallback): Computed CI with Normalized Effect Sizes**

If no pre-computed CI is available, the CI is computed using the Fisher $z$-transformation method from the normalized Pearson's $r$ values and sample sizes (see [Computing Confidence Intervals](#computing-confidence-intervals-fisher-z-transformation)).

### Classification

| Condition | Outcome |
|-----------|---------|
| Replication ES within original 95% CI | **Success** |
| Replication ES outside original 95% CI | **Failure** |
| Cannot obtain CI (missing data) | **Inconclusive** |

### Comparison with "Original in Replication CI"

These two methods can give different results:

- **Original in Replication CI** asks: "Is the original effect plausible given the replication data?"
- **Replication in Original CI** asks: "Is the replication effect plausible given the original data?"

The difference matters when sample sizes differ substantially. A small replication study will have a wide CI, making it easy for the original effect to fall within it (high "success" rate). Conversely, if the original study was large with a narrow CI, the replication effect must be very close to the original to fall within it.

---

## Computing Confidence Intervals (Fisher $z$-Transformation)

When pre-computed confidence intervals are not available in the database, they are computed using the Fisher $z$-transformation method.

### Algorithm

**Step 1: Fisher $r$-to-$z$ Transformation**

The sampling distribution of $r$ is not normal, especially for values far from zero. The Fisher transformation converts $r$ to a normally distributed variable $z$:

$$z = \frac{1}{2} \ln\left(\frac{1 + r}{1 - r}\right) = \text{arctanh}(r)$$

**Step 2: Compute Standard Error in $z$-space**

The standard error of $z$ depends only on sample size:

$$SE_z = \frac{1}{\sqrt{n - 3}}$$

where $n$ is the sample size. This requires $n > 3$.

**Step 3: Compute 95% Confidence Interval in $z$-space**

$$z_{lower} = z - 1.96 \cdot SE_z$$
$$z_{upper} = z + 1.96 \cdot SE_z$$

**Step 4: Inverse Fisher $z$-to-$r$ Transformation**

Transform the confidence bounds back to the $r$ scale:

$$r = \frac{e^{2z} - 1}{e^{2z} + 1} = \tanh(z)$$

This yields asymmetric confidence intervals in $r$-space, which is statistically appropriate since $r$ is bounded by $[-1, 1]$.

### Example

Given:
- Original effect: $r_O = 0.35$
- Replication effect: $r_R = 0.28$
- Replication sample size: $n = 100$

Computing the replication CI:

1. Fisher transform: $z_R = \text{arctanh}(0.28) = 0.288$
2. Standard error: $SE_z = 1/\sqrt{97} = 0.102$
3. CI in $z$-space: $[0.288 - 1.96 \times 0.102, 0.288 + 1.96 \times 0.102] = [0.089, 0.487]$
4. CI in $r$-space: $[\tanh(0.089), \tanh(0.487)] = [0.089, 0.452]$
5. Is $0.35$ in $[0.089, 0.452]$? **Yes** → **Success**

---

## Computing $p$-Values from Correlation Coefficients

The significance-based outcome method requires $p$-values for both original and replication studies. When the database contains a reported $p$-value (`original_p_value` or `replication_p_value`), that value is used directly. Otherwise, $p$-values are computed from the normalized Pearson $r$ correlation coefficients as described below.

### From Correlation to $t$-Statistic

For a Pearson correlation coefficient $r$ computed from $n$ observations, the test statistic follows a $t$-distribution under the null hypothesis ($H_0: \rho = 0$):

$$t = r \cdot \sqrt{\frac{n - 2}{1 - r^2}}$$

with $df = n - 2$ degrees of freedom.

### Computing Two-Tailed $p$-Values

The two-tailed $p$-value is computed from the $t$-distribution cumulative distribution function (CDF). For a $t$-statistic with $\nu$ degrees of freedom:

$$p = 2 \cdot P(T > |t|) = I_x\left(\frac{\nu}{2}, \frac{1}{2}\right)$$

where $x = \frac{\nu}{\nu + t^2}$ and $I_x(a, b)$ is the **regularized incomplete beta function**.

### Regularized Incomplete Beta Function

The regularized incomplete beta function is defined as:

$$I_x(a, b) = \frac{B(x; a, b)}{B(a, b)} = \frac{1}{B(a, b)} \int_0^x t^{a-1}(1-t)^{b-1} \, dt$$

where $B(a, b) = \frac{\Gamma(a)\Gamma(b)}{\Gamma(a+b)}$ is the complete beta function.

### Implementation

The two-tailed $p$-value is computed using the [jStat](https://github.com/jstat/jstat) JavaScript statistical library, which provides a well-tested implementation of the Student's $t$-distribution CDF. Specifically:

$$p = 2 \cdot P(T < -|t|) = 2 \cdot F_t(-|t|;\, \nu)$$

where $F_t$ is the $t$-distribution CDF with $\nu = n - 2$ degrees of freedom.

### Example

Given:
- Correlation: $r = 0.35$
- Sample size: $n = 25$

Computing the $p$-value:

1. Compute $t$-statistic: $t = 0.35 \cdot \sqrt{\frac{23}{1 - 0.1225}} = 0.35 \cdot \sqrt{26.21} = 1.792$
2. Degrees of freedom: $df = 23$
3. Compute $x = \frac{23}{23 + 3.21} = 0.878$
4. Compute $I_x(11.5, 0.5)$ using continued fraction
5. Two-tailed $p$-value: $p \approx 0.086$

Since $p > 0.05$, this correlation is **not statistically significant** at the conventional threshold.

---

## References

LeBel, E. P., Vanpaemel, W., Cheung, I., & Campbell, L. (2019). [A brief guide to evaluate replications](https://open.lnu.se/index.php/metapsychology/article/view/843). *Meta-Psychology*, 3.

Röseler, L., & Kühberger, A. (2025). [FReD: The Framework for Replication Databases](https://osf.io/preprints/metaarxiv/me2ub_v1). *MetaArXiv Preprints*.

Röseler, L., Weber, L., Helber, J., et al. (2024). [The Replication Database: Documenting the Replicability of Psychological Science](https://openpsychologydata.metajnl.com/articles/10.5334/jopd.101). *Journal of Open Psychology Data*.



