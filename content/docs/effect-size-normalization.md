# Effect Size Types and Their Normalization

| Effect Size Type | Abbreviation in Database | Convertible to $r$? |
|---|---|---|
| [Cohen's d](#cohens-d) | d | Yes |
| [Hedges' g](#hedges-g) | g | Yes |
| [Odds Ratio](#odds-ratio-or) | OR | Yes |
| [Hazard Ratio](#hazard-ratio-hr) | HR | Yes |
| [Eta Squared](#eta-squared-eta2) | etasq | Yes |
| [Cohen's f](#cohens-f) | f | Yes |
| [Cohen's f²](#cohens-f2-f2) | f² | Yes |
| [R Squared](#r-squared-r2) | R² | Yes |
| [Phi Coefficient](#phi-coefficient-phi) | phi | Yes |
| [Pearson Correlation](#pearson-correlation-r) | r | Yes (already $r$) |
| [t-test](#t-test) | t | Yes |
| [F-test](#f-test-df1--1-only) | F | Yes |
| [z-test](#z-test) | z | Yes |
| [Chi-squared](#chi-squared-df--1-only) | χ² | Yes |
| Incidence Rate Difference | IRD | No |
| [Glass' delta](#glass-delta) | Glass' delta | No |
| [Cliff's delta](#cliffs-delta) | Cliff's delta | No |
| [Cohen's w](#cohens-w) | w | No |
| Regression coefficient (standardized) | β | No |
| Regression coefficient (unstandardized) | b | No |
| Probability Difference | PD | No |
| Cohen's $d_z$ (paired) | dz | No |
| Log Ratio of Means (signed) | log ROM | No |
| [Spearman's rank correlation](#spearmans-rank-correlation) | Spearman's r | No |

The Metascience Observatory's [replications database](https://metascienceobservatory.org/replications-database) contains a wide variety of reported effect size types. To achieve commensurability between these types we convert them into an equivalent or approximate **Pearson correlation coefficient ($r$)** when possible. This converts effect sizes to a 0 to 1 scale. Not all effect size types can be converted this way, but many can. 

To consistently show reversals in effect magnitude as negatives, we always report the original effect as being positive. The replication effect sizes are then coded with a sign reflecting whether they match the original direction (positive) or reverse it (negative).

---

## Cohen's d

Cohen's $d$ gives a standardized measure of the difference between two group's means ([Cohen, 1988](#ref-cohen-1988)). It is defined as:

$$d = \frac{M_1 - M_2}{SD_{pooled}}$$

**Where:**
* $M_1, M_2$: The means of the two groups.
* $SD_{pooled}$: The pooled standard deviation of the two groups.

### Normalization to 0–1 Scale (Conversion to $r$)
The standard conversion formula used is ([Borenstein et al., 2009](#ref-borenstein-2009), p. 48):

$$r = \frac{d}{\sqrt{d^2 + \frac{(n_1 + n_2)^2}{n_1 n_2}}}$$

*Note: If sample sizes are equal ($n_1 = n_2$), this simplifies to the commonly seen approximation $r = \frac{d}{\sqrt{d^2 + 4}}$ ([Cohen, 1988](#ref-cohen-1988)).*

---

## Hedges' g

Hedges' $g$ is a bias-corrected version of Cohen's $d$ that adjusts for the slight upward bias of $d$ in small samples ([Hedges, 1981](#ref-hedges-1981)). It is defined as:

$$g = J \cdot d$$

**Where:**
* $d$: Cohen's $d$.
* $J$: The correction factor, $J = 1 - \frac{3}{4 \cdot df - 1}$, where $df = n_1 + n_2 - 2$.

### Normalization to 0–1 Scale (Conversion to $r$)
Because $g$ is on the same scale as $d$, the same conversion formula is used ([Borenstein et al., 2009](#ref-borenstein-2009), p. 48):

$$r = \frac{g}{\sqrt{g^2 + \frac{(n_1 + n_2)^2}{n_1 n_2}}}$$

*Note: If sample sizes are equal ($n_1 = n_2$), this simplifies to $r = \frac{g}{\sqrt{g^2 + 4}}$.*

---

## Odds Ratio (OR)

The Odds Ratio measures the association between an exposure and an outcome, representing the odds that an outcome will occur given a particular exposure, compared to the odds of the outcome occurring in the absence of that exposure.

$$OR = \frac{p_1 / (1 - p_1)}{p_2 / (1 - p_2)}$$

**Where:**
* $p_1$: The probability of the event in the first group (e.g., treatment group).
* $p_2$: The probability of the event in the second group (e.g., control group).

### Normalization to 0–1 scale
This is a two-step process where the Log Odds Ratio is first converted to Cohen's $d$, and then to $r$ ([Sánchez-Meca et al., 2003](#ref-sanchez-meca-2003)):

1.  **Convert to $d$:**
    $$d = \frac{\ln(OR) \cdot \sqrt{3}}{\pi}$$
2.  **Convert to $r$:**
    $$r = \frac{d}{\sqrt{d^2 + 4}}$$

---

## Hazard Ratio (HR)

The Hazard Ratio is a measure of effect size commonly used in survival analysis (e.g., Cox proportional hazards regression). It represents the ratio of the hazard rates between two groups over time.

$$HR = \frac{h_1(t)}{h_2(t)}$$

**Where:**
* $h_1(t)$: The hazard rate in the first group (e.g., treatment group) at time $t$.
* $h_2(t)$: The hazard rate in the second group (e.g., control group) at time $t$.

### Normalization to 0–1 Scale (Conversion to $r$)

The Hazard Ratio is converted using the same formula as the Odds Ratio. This approximation is most accurate when the event rate is low (< 10-15%) or follow-up time is short, conditions under which HR ≈ OR ([Sánchez-Meca et al., 2003](#ref-sanchez-meca-2003)):

1.  **Convert to $d$:**
    $$d = \frac{\ln(HR) \cdot \sqrt{3}}{\pi}$$
2.  **Convert to $r$:**
    $$r = \frac{d}{\sqrt{d^2 + 4}}$$

*Note: This conversion is an approximation. For common events or long follow-up periods, HR and OR can diverge, making the conversion less precise.*

---

## Eta Squared ($\eta^2$)

Eta squared is a measure of effect size in analysis of variance (ANOVA) that represents the proportion of total variance in the dependent variable that is associated with the membership of different groups defined by an independent variable ([Cohen, 1988](#ref-cohen-1988)).

$$\eta^2 = \frac{SS_{effect}}{SS_{total}}$$

**Where:**
* $SS_{effect}$: The sum of squares for the effect (between-groups).
* $SS_{total}$: The total sum of squares.

### Normalization to 0–1 Scale (Conversion to $r$)
The conversion is a two-step process, first converting to Cohen's $d$, then to $r$ ([Cohen, 1988](#ref-cohen-1988); [Lakens, 2013](#ref-lakens-2013)):

1.  **Convert to $d$:**
    $$d = 2\sqrt{\frac{\eta^2}{1 - \eta^2}}$$
2.  **Convert to $r$:**
    $$r = \frac{d}{\sqrt{d^2 + 4}}$$

*Note: This is algebraically equivalent to $r = \sqrt{\eta^2}$, but the code implements the two-step conversion.*

---

## Cohen's f

Cohen's $f$ is an effect size measure used commonly in the context of F-tests (ANOVA) and regression, representing the dispersion of means relative to the standard deviation ([Cohen, 1988](#ref-cohen-1988)).

$$f = \sqrt{\frac{\eta^2}{1 - \eta^2}}$$

**Where:**
* $\eta^2$: Eta squared (the proportion of variance explained).

### Normalization to 0–1 Scale (Conversion to $r$)
The conversion is a two-step process ([Cohen, 1988](#ref-cohen-1988)):

1.  **Convert to $d$:**
    $$d = 2f$$
2.  **Convert to $r$:**
    $$r = \frac{d}{\sqrt{d^2 + 4}}$$

*Note: This is algebraically equivalent to $r = \frac{f}{\sqrt{1 + f^2}}$.*

---

## Cohen's f² ($f^2$)

Cohen's $f^2$ is the squared version of Cohen's $f$, commonly used in regression contexts to measure effect size ([Cohen, 1988](#ref-cohen-1988)).

$$f^2 = \frac{R^2}{1 - R^2}$$

**Where:**
* $R^2$: The coefficient of determination.

### Normalization to 0–1 Scale (Conversion to $r$)
The conversion is a two-step process:

1.  **Convert to $R^2$:**
    $$R^2 = \frac{f^2}{1 + f^2}$$
2.  **Convert to $r$:**
    $$r = \sqrt{R^2}$$

---

## R Squared ($R^2$)

$R^2$ (the coefficient of determination) represents the proportion of the variance for a dependent variable that's explained by an independent variable or variables in a regression model.

$$R^2 = 1 - \frac{SS_{res}}{SS_{total}}$$

**Where:**
* $SS_{res}$: The sum of squares of residuals (unexplained variance).
* $SS_{total}$: The total sum of squares (total variance).

### Normalization to 0–1 Scale (Conversion to $r$)
The database normalizes this value by simply taking the square root:

$$r = \sqrt{R^2}$$

---

## Phi Coefficient ($\phi$)

The Phi coefficient is a measure of association for two binary variables ([Cramér, 1946](#ref-cramer-1946)).

$$\phi = \frac{ad - bc}{\sqrt{(a+b)(c+d)(a+c)(b+d)}}$$

**Where:**
* $a, b, c, d$: The frequencies in a $2 \times 2$ contingency table.

### Normalization to 0–1 Scale (Conversion to $r$)
No conversion is needed for the Phi coefficient, as it is already equivalent to the Pearson correlation coefficient calculated for binary data.

$$r = \phi$$

---

## Pearson Correlation ($r$)

The Pearson correlation coefficient measures the linear correlation between two sets of data ([Pearson, 1895](#ref-pearson-1895)).

$$r = \frac{\sum(x_i - \bar{x})(y_i - \bar{y})}{\sqrt{\sum(x_i - \bar{x})^2 \sum(y_i - \bar{y})^2}}$$

**Where:**
* $x_i, y_i$: Individual sample points.
* $\bar{x}, \bar{y}$: The sample means.

### Normalization to 0–1 Scale
This metric serves as the target scale for the database, so no conversion is needed. As mentioned above, to maintain the "0 to 1" magnitude scale required by the database's coding scheme, original effect sizes are taken as their absolute value:

$$r_{coded} = |r_{reported}|$$

---

## Test Statistics

The database can also convert APA-formatted test statistics directly to $r$ ([Rosenthal, 1991](#ref-rosenthal-1991); [Borenstein et al., 2009](#ref-borenstein-2009)).

### t-test

**Format:** `t(df) = value` (e.g., `t(10) = 2.5`)

**Conversion to $r$:**
$$r = \frac{t}{\sqrt{t^2 + df}}$$

*Sign is preserved (negative t produces negative r).*

---

### F-test (df1 = 1 only)

**Format:** `F(df1, df2) = value` (e.g., `F(1, 20) = 4.5`)

**Constraint:** Only convertible when df1 = 1.

**Conversion to $r$:**
1.  **Convert F to t:**
    $$t = \sqrt{F}$$
2.  **Convert t to r:**
    $$r = \frac{t}{\sqrt{t^2 + df_2}}$$

*Always positive (F-tests are non-directional).*

---

### z-test

**Format:** `z = value, N = value` (e.g., `z = 2.81, N = 34`)

**Conversion to $r$:**
$$r = \frac{z}{\sqrt{z^2 + N}}$$

*Sign is preserved.*

---

### Chi-squared (df = 1 only)

**Format:** `χ2(1, N = value) = value` or `x2(1, N = value) = value` (e.g., `χ2(1, N = 12) = 5`)

**Constraint:** Only convertible when df = 1.

**Conversion to $r$:**
$$r = \sqrt{\frac{\chi^2}{N}}$$

*Always positive.*

---

## Glass' delta

Glass's $\Delta$ (delta) is a standardized mean difference that uses only the **control group's** standard deviation as the denominator, rather than the pooled SD used by Cohen's $d$ ([Glass, 1976](#ref-glass-1976)).

$$\Delta = \frac{M_1 - M_2}{SD_{control}}$$

**Where:**
* $M_1, M_2$: The means of the two groups.
* $SD_{control}$: The standard deviation of the control group only.

**Why not converted to $r$:** The standard $d$-to-$r$ conversion assumes a pooled standard deviation. Using only one group's SD introduces asymmetry that makes the conversion unreliable without additional information about group variance ratios.

---

## Cliff's delta

Cliff's $\delta$ is a non-parametric effect size that measures the degree of overlap between two distributions ([Cliff, 1993](#ref-cliff-1993)). It represents the probability that a randomly selected observation from one group is larger than a randomly selected observation from the other, minus the reverse probability.

$$\delta = \frac{\#(x_i > y_j) - \#(x_i < y_j)}{n_1 \cdot n_2}$$

**Where:**
* $x_i$: Observations from group 1.
* $y_j$: Observations from group 2.
* $n_1, n_2$: The sample sizes of the two groups.
* $\#(x_i > y_j)$: The count of all pairwise comparisons where $x_i$ exceeds $y_j$.

*Range: $-1$ to $+1$, where $0$ indicates complete overlap.*

**Why not converted to $r$:** Cliff's delta is a non-parametric, ordinal-level measure with no distributional assumptions. Converting it to Pearson's $r$ (a parametric measure) would require assumptions about the underlying distributions that the statistic was specifically designed to avoid.

---

## Cohen's w

Cohen's $w$ is an effect size measure for chi-squared tests of goodness-of-fit or independence ([Cohen, 1988](#ref-cohen-1988)). It quantifies the discrepancy between observed and expected proportions.

$$w = \sqrt{\sum_{i=1}^{m} \frac{(P_{1i} - P_{0i})^2}{P_{0i}}}$$

**Where:**
* $P_{1i}$: The observed (or alternative hypothesis) proportion in category $i$.
* $P_{0i}$: The expected (or null hypothesis) proportion in category $i$.
* $m$: The number of categories.

**Why not converted to $r$:** Cohen's $w$ applies to multi-category frequency comparisons and does not map onto the two-variable linear association that Pearson's $r$ measures. While $w = \phi$ in the special case of a $2 \times 2$ table, the general case involves tables of arbitrary size.

---

## Spearman's rank correlation

Spearman's $r_s$ (rho) measures the monotonic relationship between two variables using their ranks rather than raw values ([Spearman, 1904](#ref-spearman-1904)).

$$r_s = 1 - \frac{6 \sum d_i^2}{n(n^2 - 1)}$$

**Where:**
* $d_i$: The difference between the ranks of the $i$-th paired observation.
* $n$: The number of paired observations.

*Range: $-1$ to $+1$, identical to Pearson's $r$.*

**Why not converted to $r$:** Although Spearman's $r_s$ is on the same numerical scale as Pearson's $r$, it measures monotonic (not linear) association and is computed on ranks rather than raw values. Treating it as interchangeable with Pearson's $r$ in meta-analytic comparisons would conflate two distinct constructs.

---

## Non-Convertible Effect Sizes

The following effect sizes cannot be reliably converted to $r$ and thus will not have an entry computed for the *replication_es_r* and *original_es_r* columns:

* Incidence Rate Difference (IRD) — raw percentage-point differences between groups, on a scale of roughly −100 to +100, incompatible with the standardized 0–1 scale
* Partial eta-squared ($\eta^2_p$)
* Cramér's V
* Cohen's h
* Cohen's $d_z$ (standardized mean difference for paired designs)
* Cliff's delta
* Cohen's w
* Regression coefficients ($b$, $\beta$)
* Semi-partial correlations ($sr^2$)
* Chi-squared with df > 1
* Percentages

---

## References

<span id="ref-borenstein-2009"></span>
Borenstein, M., Hedges, L. V., Higgins, J. P. T., & Rothstein, H. R. (2009). [*Introduction to meta-analysis*](https://doi.org/10.1002/9780470743386). John Wiley & Sons.

<span id="ref-cliff-1993"></span>
Cliff, N. (1993). [Dominance statistics: Ordinal analyses to answer ordinal questions](https://doi.org/10.1037/0033-2909.114.3.494). *Psychological Bulletin*, 114(3), 494–509.

<span id="ref-cohen-1988"></span>
Cohen, J. (1988). [*Statistical power analysis for the behavioral sciences*](https://doi.org/10.4324/9780203771587) (2nd ed.). Lawrence Erlbaum Associates.

<span id="ref-cramer-1946"></span>
Cramér, H. (1946). [*Mathematical methods of statistics*](https://archive.org/details/mathematicalmeth0000cram). Princeton University Press.

<span id="ref-glass-1976"></span>
Glass, G. V. (1976). [Primary, secondary, and meta-analysis of research](https://doi.org/10.3102/0013189X005010003). *Educational Researcher*, 5(10), 3–8.

<span id="ref-hedges-1981"></span>
Hedges, L. V. (1981). [Distribution theory for Glass's estimator of effect size and related estimators](https://doi.org/10.3102/10769986006002107). *Journal of Educational Statistics*, 6(2), 107–128.

<span id="ref-lakens-2013"></span>
Lakens, D. (2013). [Calculating and reporting effect sizes to facilitate cumulative science: A practical primer for t-tests and ANOVAs](https://doi.org/10.3389/fpsyg.2013.00863). *Frontiers in Psychology*, 4, 863.

<span id="ref-pearson-1895"></span>
Pearson, K. (1895). [Notes on regression and inheritance in the case of two parents](https://doi.org/10.1098/rspl.1895.0041). *Proceedings of the Royal Society of London*, 58, 240–242.

<span id="ref-rosenthal-1991"></span>
Rosenthal, R. (1991). [*Meta-analytic procedures for social research*](https://doi.org/10.4135/9781412984997) (Rev. ed.). Sage Publications.

<span id="ref-sanchez-meca-2003"></span>
Sánchez-Meca, J., Marín-Martínez, F., & Chacón-Moscoso, S. (2003). [Effect-size indices for dichotomized outcomes in meta-analysis](https://doi.org/10.1037/1082-989X.8.4.448). *Psychological Methods*, 8(4), 448–467.

<span id="ref-spearman-1904"></span>
Spearman, C. (1904). [The proof and measurement of association between two things](https://doi.org/10.2307/1412159). *The American Journal of Psychology*, 15(1), 72–101.
