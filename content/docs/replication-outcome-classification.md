# Mathematical Methods for Classifying Replication Outcomes

The Replications Database provides four definitions of replication success: the outcome **as recorded in the database** (the `result` column), plus three statistical methods computed from the effect sizes. The significance method normally uses normalized Pearson's $r$ values and reported or computed $p$-values. The confidence-interval methods first try raw effect sizes with reported intervals, then fall back to normalized $r$ values (see [Effect Size Normalization](/docs/effect-size-normalization)). These are operational classification rules, not definitive tests of whether a scientific claim is true.

| Method | Question Asked |
|--------|----------------|
| [Reported result](#how-the-replication-rate-is-computed) | What outcome did the replication authors (or our extraction) record? |
| [Statistically Significant Effect in the Same Direction?](#statistically-significant-effect-in-the-same-direction) | Is the replication effect statistically significant in the same direction as the original? |
| [Original Effect Size in Replication 95% CI](#original-effect-size-in-replication-95-confidence-interval) | Does the original effect size fall within the replication's 95% confidence interval? |
| [Replication Effect Size in Original 95% CI](#replication-effect-size-in-original-95-confidence-interval) | Does the replication effect size fall within the original's 95% confidence interval? |

---

## How the Replication Rate Is Computed

The shared classifier uses four labels: **success**, **failure**, **reversal**, and **inconclusive**. The CI methods return only success, failure, or inconclusive; they do not separately label reversals. The reported-result method recognizes the recorded success, failure, and reversal labels after trimming whitespace and ignoring case; blank or unrecognized values are treated as inconclusive. Rates also depend on the denominator, unit of analysis, and page filters.

### The definition

$$\text{replication rate} = \frac{\text{success}}{\text{success} + \text{failure} + \text{reversal}}$$

Two decisions are embedded here:

**A reversal counts as a failure.** Under the significance rule, this normally means a significant replication effect with the opposite sign to a significant original effect. For reported results, it is the stored classification. Both failure and reversal enter the denominator as non-successes; neither label alone establishes a statistically significant difference between the two effect estimates.

**Inconclusive results are excluded, not counted as failures.** Rows without enough usable inputs are not automatically failures. Recorded inconclusive outcomes and rows with no recognized outcome are excluded too. This rate is conditional on the classified subset; missingness can affect how representative that subset is. If there are no classified rows, the rate is undefined, not zero.

### The unit of analysis

The site-wide headline counts one **replication effect** — one row of the database — as one observation. This is the simplest unit to describe, and it introduces no threshold parameter that would need defending.

Some pages also offer a **paper-level** view, which groups rows by the original paper URL and asks whether at least a given share of its classified effect replications succeeded (75% by default on the by-year page). This answers a different question — "what fraction of *papers* hold up?" rather than "what fraction of *findings* hold up?" — and it weights a paper with one replicated effect equally with a paper with twenty. Rows without an original paper URL and papers without classified effects are excluded from this aggregation. Check the threshold and filters on the page being used.

Note that the effect-level rate gives more weight to heavily-replicated papers, and the paper-level rate gives more weight to lightly-replicated ones. Neither is "correct"; they answer different questions.

### Coverage filters

Several pages restrict the denominator further — to originals with a recorded publication year, or a $p$-value below 0.05, or a match in an external citation, h-index, or journal-metric dataset. Those restrictions change the rate, sometimes by several points, purely by changing which studies are in scope. Compare rates only after checking the selected method, filters, and denominator on each page.

### Sensitivity of the headline number

Including inconclusive rows in the denominator lowers the rate; excluding reversals raises it. Paper-level rates additionally depend on the chosen success threshold and which rows can be grouped by paper. These changes answer different questions and should be reported with the rate.

Use the current dashboard for percentages and sample sizes. Different statistical methods also classify different subsets of rows, so their rates can differ because of both the decision rule and data availability.

---

## Statistically Significant Effect in the Same Direction?

This method evaluates whether the replication study achieves a statistically significant result in the same direction as the original study.

### Rationale

The simplest criterion for replication success: if the original study found a significant effect in one direction, a successful replication should also find a significant effect in that same direction. When the original study was not significant, the method checks whether the replication agrees (also non-significant) or disagrees (significant).

### Algorithm

This method is inspired by the [FReD success-criteria documentation](https://forrt.org/fred/articles/success_criteria.html) (`criterion = "significance_r"`), with modifications to handle non-significant originals and to prefer reported $p$-values over computed ones.

**Step 1: Check Available Inputs and Determine $p$-Values**

The main code path requires finite normalized correlations in $[-1,1]$ and finite sample sizes greater than 2 for both studies, even when reported $p$-values are available. When both normalized correlations and positive sample sizes are present but either sample size is at most 2, the result is inconclusive.

If that path cannot be entered, a fallback uses both reported numeric $p$-values and both raw effect sizes, comparing their signs. If those inputs are also unavailable, the result is **inconclusive**. This fallback needs caution: the sign of a raw ratio (for example, an odds ratio with null value 1) does not encode direction relative to its null.

For both the original and replication studies, the $p$-value is determined using this priority:

1. **Use the reported $p$-value** from the database (`original_p_value` or `replication_p_value`) if available
2. **Otherwise, compute** the $p$-value from the normalized Pearson $r$ and sample size $n$:

$$t = r \cdot \sqrt{\frac{n - 2}{1 - r^2}}$$

Compute the two-tailed $p$-value with $df = n - 2$ degrees of freedom.

Reported $p$-values can reflect the original analysis design, covariate adjustment, or test that a calculation from normalized $r$ and total sample size does not reproduce. The current parser accepts finite numeric values; strings such as `"<0.05"` do not count as numeric $p$-values. It does not enforce the valid $[0,1]$ range, so classification depends on upstream data quality.

**Step 2: Check if the Original Study Was Significant**

If $p_O \geq 0.05$, the original was not significant. In this case, we check whether the replication agrees:

- If the replication is also not significant ($p_R \geq 0.05$): both are classified as non-significant → **Success under this rule**. This does **not** establish that there is no effect or that the effects are equivalent
- If the replication is significant ($p_R < 0.05$): the studies disagree → **Failure**

**Step 3: If the Original Was Significant, Test the Replication**

If the original was significant ($p_O < 0.05$), check the replication's significance and direction consistency:

- **Same direction**: $\text{sign}(r_O) = \text{sign}(r_R)$
- **Opposite direction**: $\text{sign}(r_O) \neq \text{sign}(r_R)$

### Classification

A difference in statistical significance is not itself evidence of a statistically significant difference between effects. Conversely, two non-significant results can both be imprecise.

| Condition | Outcome |
|-----------|---------|
| Original not significant ($p_O \geq 0.05$), replication also not significant ($p_R \geq 0.05$) | **Success** |
| Original not significant ($p_O \geq 0.05$), replication significant ($p_R < 0.05$) | **Failure** |
| Original significant, replication significant ($p_R < 0.05$) with same direction  | **Success** |
| Original significant, replication significant ($p_R < 0.05$) with opposite direction | **Reversal** |
| Original significant, replication not significant ($p_R \geq 0.05$) | **Failure** |
| Required inputs unavailable or unusable | **Inconclusive** |

The implementation uses `Math.sign` for direction, so zero has its own sign. A zero effect paired with a contradictory significant reported $p$-value can therefore receive a reversal label; such rows require data review.

---

## Original Effect Size in Replication 95% Confidence Interval

This method checks whether the original effect size is a plausible value given the replication results, by testing if it falls within the replication's confidence interval.

### Rationale

This checks inclusion of the original point estimate in the replication interval. It accounts for uncertainty in the replication estimate, but treats the original estimate as fixed. It is neither a joint test of equal effects nor a 95% prediction interval for a replication estimate.

The point-in-interval criterion is described in the [FReD success-criteria documentation](https://forrt.org/fred/articles/success_criteria.html) (`criterion = "consistency_ci"`).

### Confidence Interval Source

The method tries a reported interval first, subject to the metric compatibility check below, and otherwise tries a computed interval:

**Strategy 1 (Primary): Pre-computed CI with Raw Effect Sizes**

If the database contains a pre-computed 95% CI for the replication effect size (in the `replication_es_95_CI` column), this CI is compared against the **raw original effect size** (`original_es`). This comparison requires a common effect-size scale and consistent coding of the outcome and comparison groups. The code skips this path when both type labels are recognized and belong to different metric families. Missing or unrecognized labels are allowed, and some families include distinct measures (for example, odds ratios and risk ratios), so passing this check does not guarantee comparability.

**Strategy 2 (Fallback): Computed CI with Normalized Effect Sizes**

If the interval cannot be parsed, the raw point estimate is missing, or the metric check rejects the comparison, the CI is computed using the Fisher $z$-transformation method from the normalized Pearson's $r$ values and sample sizes (see [Computing Confidence Intervals](#computing-confidence-intervals-fisher-z-transformation)).

### Classification

| Condition | Outcome |
|-----------|---------|
| Original ES within replication 95% CI | **Success** |
| Original ES outside replication 95% CI | **Failure** |
| Cannot obtain CI (missing data) | **Inconclusive** |

### Interpretation and limitations

The rule uses effect magnitude and interval width without requiring significance. A wide interval can include substantially different effects, so “success” is not proof of equivalence. A narrow interval can exclude a nearby estimate. The supplied interval is assumed to be a 95% CI; the code does not verify its confidence level or reconstruct the paper's analysis. Endpoints are included in the success region. If neither data path works, the result is inconclusive.

---

## Replication Effect Size in Original 95% Confidence Interval

This method checks whether the replication effect size is a plausible value given the original results, by testing if it falls within the original's confidence interval.

### Rationale

This is the "mirror" of the previous method. If the replication is measuring the same underlying effect, we would expect the replication effect size to be consistent with the original's estimate. This is operationalized by checking whether the replication effect falls within the 95% confidence interval of the original effect.

A narrower original interval makes this criterion harder to satisfy. A larger sample often improves precision, but interval width also depends on the design and variability. This rule ignores sampling uncertainty in the replication point estimate and is not a test that accounts for uncertainty in both studies.

### Confidence Interval Source

The method tries a reported interval first, subject to the metric compatibility check below, and otherwise tries a computed interval:

**Strategy 1 (Primary): Pre-computed CI with Raw Effect Sizes**

If the database contains a pre-computed 95% CI for the original effect size (in the `original_es_95_CI` column), this CI is compared against the **raw replication effect size** (`replication_es`). This comparison requires a common effect-size scale and consistent coding of the outcome and comparison groups. The code skips this path when both type labels are recognized and belong to different metric families. Missing or unrecognized labels are allowed, and some families include distinct measures (for example, odds ratios and risk ratios), so passing this check does not guarantee comparability.

**Strategy 2 (Fallback): Computed CI with Normalized Effect Sizes**

If the interval cannot be parsed, the raw point estimate is missing, or the metric check rejects the comparison, the CI is computed using the Fisher $z$-transformation method from the normalized Pearson's $r$ values and sample sizes (see [Computing Confidence Intervals](#computing-confidence-intervals-fisher-z-transformation)).

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

The difference matters when the studies have different precision. A wide replication CI makes inclusion of the original estimate easier. A narrow original CI requires the replication estimate to be closer to the original. Neither result establishes equivalence, and neither criterion separately classifies reversals.

---

## Computing Confidence Intervals (Fisher $z$-Transformation)

When pre-computed confidence intervals are not available in the database, they are computed using the Fisher $z$-transformation method.

### Algorithm

**Step 1: Fisher $r$-to-$z$ Transformation**

The sampling distribution of $r$ is not normal, especially for values far from zero. For independent observations under the usual bivariate-normal correlation model, the Fisher transformation gives an approximately normal sampling distribution:

$$z = \frac{1}{2} \ln\left(\frac{1 + r}{1 - r}\right) = \text{arctanh}(r)$$

**Step 2: Compute Standard Error in $z$-space**

The standard error of $z$ depends only on sample size:

$$SE_z = \frac{1}{\sqrt{n - 3}}$$

where $n$ is the sample size. This approximation requires $n > 3$ and $|r| < 1$. The implementation returns no computed interval when $|r| \geq 0.9999$. For correlations converted from other statistics, or for clustered, paired, adjusted, or dependent estimates, the formula may not reproduce the appropriate standard error.

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
4. CI in $r$-space: $[\tanh(0.088674), \tanh(0.486690)] \approx [0.088, 0.452]$
5. Is $0.35$ in $[0.088, 0.452]$? **Yes** → **Success**

---

## Computing $p$-Values from Correlation Coefficients

The significance-based outcome method requires $p$-values for both original and replication studies. When the database contains a reported $p$-value (`original_p_value` or `replication_p_value`), that value is used directly. Otherwise, $p$-values are computed from the normalized Pearson $r$ correlation coefficients as described below.

### From Correlation to $t$-Statistic

For a Pearson correlation from independent observations under the bivariate-normal model, the following statistic has a $t$-distribution under the null hypothesis ($H_0: \rho = 0$). Applying it to converted effect sizes is an approximation:

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

The two-tailed $p$-value is computed using the [jStat](https://github.com/jstat/jstat) JavaScript statistical library and its Student's $t$-distribution CDF. Specifically:

$$p = 2 \cdot P(T < -|t|) = 2 \cdot F_t(-|t|;\, \nu)$$

where $F_t$ is the $t$-distribution CDF with $\nu = n - 2$ degrees of freedom. The helper requires $n > 2$ and currently returns zero for $|r| \geq 0.9999$, a numerical shortcut rather than an exact tail probability.

### Example

Given:
- Correlation: $r = 0.35$
- Sample size: $n = 25$

Computing the $p$-value:

1. Compute $t$-statistic: $t = 0.35 \cdot \sqrt{\frac{23}{1 - 0.1225}} = 0.35 \cdot \sqrt{26.21} = 1.792$
2. Degrees of freedom: $df = 23$
3. Compute $x = \frac{23}{23 + 3.21} = 0.878$
4. Evaluate $2F_t(-1.791878; 23)$ using jStat (equivalently, $I_x(11.5, 0.5)$)
5. Two-tailed $p$-value: $p \approx 0.086$

Since $p > 0.05$, this correlation is **not statistically significant** at the conventional threshold.

---

## References

LeBel, E. P., Vanpaemel, W., Cheung, I., & Campbell, L. (2019). [A brief guide to evaluate replications](https://open.lnu.se/index.php/metapsychology/article/view/843). *Meta-Psychology*, 3.

Röseler, L., Kaiser, L., Doetsch, C., et al. (2024). [The Replication Database: Documenting the Replicability of Psychological Science](https://openpsychologydata.metajnl.com/articles/10.5334/jopd.101). *Journal of Open Psychology Data*, 12(1), Article 8.
