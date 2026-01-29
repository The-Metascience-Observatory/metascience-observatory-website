# Mathematical Methods for Classifying Replication Outcomes

The Replications Database provides three statistical methods for classifying whether a replication attempt was successful. All methods operate on effect sizes that have been converted to Pearson's $r$ (see [Effect Size Normalization](/docs/effect-size-normalization)).

| Method | Question Asked |
|--------|----------------|
| [Statistically Significant Effect in the Same Direction?](#statistically-significant-effect-in-the-same-direction) | Is the replication effect statistically significant in the same direction as the original? |
| [Original Effect Size in Replication 95% CI](#original-effect-size-in-replication-95-confidence-interval) | Does the original effect size fall within the replication's 95% confidence interval? |
| [Replication Effect Size in Original 95% CI](#replication-effect-size-in-original-95-confidence-interval) | Does the replication effect size fall within the original's 95% confidence interval? |

---

## Statistically Significant Effect in the Same Direction?

This method evaluates whether the replication study achieves a statistically significant result in the same direction as the original study.

This method is based on the [FReD R package](https://github.com/forrtproject/FReD) (`criterion = "significance_r"`), with an additional **reversal** outcome for significant effects in the opposite direction.

### Rationale

The simplest criterion for replication success: if the original study found a significant effect in one direction, a successful replication should also find a significant effect in that same direction.

**Important**: This criterion only makes sense when the original study was statistically significant. If the original study was not significant, the criterion is meaningless and returns "inconclusive."

A **reversal** is a particularly noteworthy outcome: the replication finds a statistically significant effect, but in the *opposite* direction from the original. This is stronger evidence against the original finding than a simple failure to replicate—it suggests the original finding may have been wrong about the direction of the effect.

### Algorithm

**Step 1: Check if the Original Study Was Significant**

First, compute the $p$-value for the original effect:

$$t_O = r_O \cdot \sqrt{\frac{n_O - 2}{1 - r_O^2}}$$

Compute the two-tailed $p$-value with $df = n_O - 2$ degrees of freedom. If $p_O \geq 0.05$, the original was not significant, and the outcome is **inconclusive** (criterion is meaningless).

**Step 2: Test Significance of Replication Effect**

If the original was significant, compute the $p$-value for the replication effect:

$$t_R = r_R \cdot \sqrt{\frac{n_R - 2}{1 - r_R^2}}$$

where $n_R$ is the replication sample size and $r_R$ is the replication effect size.

Compute the two-tailed $p$-value with $df = n_R - 2$ degrees of freedom.

**Step 3: Check Direction Consistency**

Compare the signs of the original ($r_O$) and replication ($r_R$) effect sizes:

- **Same direction**: $\text{sign}(r_O) = \text{sign}(r_R)$
- **Opposite direction**: $\text{sign}(r_O) \neq \text{sign}(r_R)$

### Classification

| Condition | Outcome |
|-----------|---------|
| Original not significant ($p_O \geq 0.05$) | **Inconclusive** |
| Same direction AND replication significant ($p_R < 0.05$) | **Success** |
| Opposite direction AND replication significant ($p_R < 0.05$) | **Reversal** |
| Replication not significant ($p_R \geq 0.05$) | **Failure** |
| Cannot compute (missing data, $n \leq 2$) | **Inconclusive** |

### Limitations

- Does not account for the magnitude of effects, only direction and significance
- A replication with a much smaller effect size can still be classified as "success" if significant
- Significance depends heavily on sample size
- Non-significant replications are always classified as "failure," even if they show effects in the same direction

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

The significance-based outcome method requires computing $p$-values from correlation coefficients. This section describes the mathematical approach used.

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

### Numerical Implementation

The implementation uses the following techniques for numerical accuracy:

**1. Continued Fraction Expansion (Lentz's Algorithm)**

The incomplete beta function is computed using a continued fraction representation, which converges rapidly for appropriate values of $x$:

$$I_x(a, b) = \frac{x^a (1-x)^b}{a \cdot B(a, b)} \cdot \cfrac{1}{1 + \cfrac{d_1}{1 + \cfrac{d_2}{1 + \cdots}}}$$

where the coefficients $d_m$ are:

- For even $m = 2k$: $d_m = \frac{k(b-k)x}{(a+2k-1)(a+2k)}$
- For odd $m = 2k+1$: $d_m = -\frac{(a+k)(a+b+k)x}{(a+2k)(a+2k+1)}$

**2. Symmetry Relation**

For better convergence, the symmetry property is used when $x > \frac{a+1}{a+b+2}$:

$$I_x(a, b) = 1 - I_{1-x}(b, a)$$

**3. Log-Gamma via Lanczos Approximation**

The beta function is computed using logarithms of the gamma function for numerical stability:

$$\ln B(a, b) = \ln\Gamma(a) + \ln\Gamma(b) - \ln\Gamma(a+b)$$

The log-gamma function uses the Lanczos approximation with $g = 7$ and precomputed coefficients, providing accuracy to approximately 15 significant digits.

### Accuracy

This implementation provides accurate $p$-values across all degrees of freedom, including:

- **Small samples** ($n < 30$): Critical for cancer biology and other fields with small sample sizes
- **Large samples** ($n > 1000$): Correctly handles the convergence to normal distribution
- **Edge cases**: Correlations near $\pm 1$ are handled with appropriate bounds

The numerical precision is approximately $10^{-14}$ relative error, sufficient for all practical significance testing applications.

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

LeBel, E. P., Vanpaemel, W., Cheung, I., & Campbell, L. (2019). [A brief guide to evaluate replications](https://doi.org/10.1037/met0000255). *Meta-Psychology*, 3.

Open Science Collaboration. (2015). [Estimating the reproducibility of psychological science](https://doi.org/10.1126/science.aac4716). *Science*, 349(6251), aac4716.

Press, W. H., Teukolsky, S. A., Vetterling, W. T., & Flannery, B. P. (2007). [*Numerical Recipes: The Art of Scientific Computing*](https://numerical.recipes/) (3rd ed.). Cambridge University Press. (Chapters 6.1–6.4 on special functions)

Simonsohn, U. (2015). [Small telescopes: Detectability and the evaluation of replication results](https://doi.org/10.1177/0956797614567341). *Psychological Science*, 26(5), 559-569.
