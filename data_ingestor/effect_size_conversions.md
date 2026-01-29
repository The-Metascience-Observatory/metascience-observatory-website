# Effect Size Types and Their Normalization

The **Replication Database** handles a wide variety of effect sizes. It achieves commensurability by converting actionable effect sizes into **Pearson correlation coefficients ($r$)**, which serves as the common metric.

To ensure a consistent magnitude scale for comparison (effectively acting as a 0–1 scale), the database codes **original** effect sizes as positive values. **Replication** effect sizes are then coded with signs reflecting whether they match the original direction (positive) or reverse it (negative).

---

## Cohen's d

Cohen's $d$ gives a standardized measure of the difference between two group's means (Cohen, 1988). It is defined as:

$$d = \frac{M_1 - M_2}{SD_{pooled}}$$

**Where:**
* $M_1, M_2$: The means of the two groups.
* $SD_{pooled}$: The pooled standard deviation of the two groups.

### Normalization to 0–1 Scale (Conversion to $r$)
The standard conversion formula used is (Borenstein et al., 2009, p. 48):

$$r = \frac{d}{\sqrt{d^2 + \frac{(n_1 + n_2)^2}{n_1 n_2}}}$$

*Note: If sample sizes are equal ($n_1 = n_2$), this simplifies to the commonly seen approximation $r = \frac{d}{\sqrt{d^2 + 4}}$ (Cohen, 1988).*


---

## Odds Ratio (OR)

The Odds Ratio measures the association between an exposure and an outcome, representing the odds that an outcome will occur given a particular exposure, compared to the odds of the outcome occurring in the absence of that exposure.

$$OR = \frac{p_1 / (1 - p_1)}{p_2 / (1 - p_2)}$$

**Where:**
* $p_1$: The probability of the event in the first group (e.g., treatment group).
* $p_2$: The probability of the event in the second group (e.g., control group).

### Normalization to 0–1 scale
This is a two-step process where the Log Odds Ratio is first converted to Cohen's $d$, and then to $r$ (Sánchez-Meca et al., 2003):

1.  **Convert to $d$:**
    $$d = \frac{\ln(OR) \cdot \sqrt{3}}{\pi}$$
2.  **Convert to $r$:**
    $$r = \frac{d}{\sqrt{d^2 + 4}}$$

---

## Eta Squared ($\eta^2$)

Eta squared is a measure of effect size in analysis of variance (ANOVA) that represents the proportion of total variance in the dependent variable that is associated with the membership of different groups defined by an independent variable (Cohen, 1988).

$$\eta^2 = \frac{SS_{effect}}{SS_{total}}$$

**Where:**
* $SS_{effect}$: The sum of squares for the effect (between-groups).
* $SS_{total}$: The total sum of squares.

### Normalization to 0–1 Scale (Conversion to $r$)
The conversion is a two-step process, first converting to Cohen's $d$, then to $r$ (Cohen, 1988; Lakens, 2013):

1.  **Convert to $d$:**
    $$d = 2\sqrt{\frac{\eta^2}{1 - \eta^2}}$$
2.  **Convert to $r$:**
    $$r = \frac{d}{\sqrt{d^2 + 4}}$$

*Note: This is algebraically equivalent to $r = \sqrt{\eta^2}$, but the code implements the two-step conversion.*

---

## Cohen's f

Cohen's $f$ is an effect size measure used commonly in the context of F-tests (ANOVA) and regression, representing the dispersion of means relative to the standard deviation (Cohen, 1988).

$$f = \sqrt{\frac{\eta^2}{1 - \eta^2}}$$

**Where:**
* $\eta^2$: Eta squared (the proportion of variance explained).

### Normalization to 0–1 Scale (Conversion to $r$)
The conversion is a two-step process (Cohen, 1988):

1.  **Convert to $d$:**
    $$d = 2f$$
2.  **Convert to $r$:**
    $$r = \frac{d}{\sqrt{d^2 + 4}}$$

*Note: This is algebraically equivalent to $r = \frac{f}{\sqrt{1 + f^2}}$.*

---

## Cohen's f² ($f^2$)

Cohen's $f^2$ is the squared version of Cohen's $f$, commonly used in regression contexts to measure effect size (Cohen, 1988).

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

The Phi coefficient is a measure of association for two binary variables (Cramér, 1946).

$$\phi = \frac{ad - bc}{\sqrt{(a+b)(c+d)(a+c)(b+d)}}$$

**Where:**
* $a, b, c, d$: The frequencies in a $2 \times 2$ contingency table.

### Normalization to 0–1 Scale (Conversion to $r$)
No conversion is needed for the Phi coefficient, as it is already equivalent to the Pearson correlation coefficient calculated for binary data (Pearson, 1900).

$$r = \phi$$

---

## Pearson Correlation ($r$)

The Pearson correlation coefficient measures the linear correlation between two sets of data (Pearson, 1895).

$$r = \frac{\sum(x_i - \bar{x})(y_i - \bar{y})}{\sqrt{\sum(x_i - \bar{x})^2 \sum(y_i - \bar{y})^2}}$$

**Where:**
* $x_i, y_i$: Individual sample points.
* $\bar{x}, \bar{y}$: The sample means.

### Normalization to 0–1 Scale
This metric serves as the **target scale** for the database. No conversion is needed. To maintain the "0 to 1" magnitude scale required by the database's coding scheme, original effect sizes are taken as their absolute value:

$$r_{coded} = |r_{reported}|$$

---

## Test Statistics

The database can also convert APA-formatted test statistics directly to $r$ (Rosenthal, 1991; Borenstein et al., 2009).

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

## Non-Convertible Effect Sizes

The following effect sizes cannot be reliably converted to $r$ and are returned as missing values:

* Partial eta-squared ($\eta^2_p$)
* Cramér's V
* Cohen's h
* Cohen's $d_z$ (standardized mean difference for paired designs)
* Regression coefficients ($b$, $\beta$)
* Semi-partial correlations ($sr^2$)
* Chi-squared with df > 1
* Hazard ratios
* Percentages

---

## References

Borenstein, M., Hedges, L. V., Higgins, J. P. T., & Rothstein, H. R. (2009). [*Introduction to meta-analysis*](https://doi.org/10.1002/9780470743386). John Wiley & Sons.

Cohen, J. (1988). [*Statistical power analysis for the behavioral sciences*](https://doi.org/10.4324/9780203771587) (2nd ed.). Lawrence Erlbaum Associates.

Cramér, H. (1946). [*Mathematical methods of statistics*](https://archive.org/details/mathematicalmeth0000cram). Princeton University Press.

Lakens, D. (2013). [Calculating and reporting effect sizes to facilitate cumulative science: A practical primer for t-tests and ANOVAs](https://doi.org/10.3389/fpsyg.2013.00863). *Frontiers in Psychology*, 4, 863.

Pearson, K. (1895). [Notes on regression and inheritance in the case of two parents](https://doi.org/10.1098/rspl.1895.0041). *Proceedings of the Royal Society of London*, 58, 240–242.

Pearson, K. (1900). [On the criterion that a given system of deviations from the probable in the case of a correlated system of variables is such that it can be reasonably supposed to have arisen from random sampling](https://doi.org/10.1080/14786440009463897). *Philosophical Magazine*, 50(302), 157–175.

Rosenthal, R. (1991). [*Meta-analytic procedures for social research*](https://doi.org/10.4135/9781412984997) (Rev. ed.). Sage Publications.

Sánchez-Meca, J., Marín-Martínez, F., & Chacón-Moscoso, S. (2003). [Effect-size indices for dichotomized outcomes in meta-analysis](https://doi.org/10.1037/1082-989X.8.4.448). *Psychological Methods*, 8(4), 448–467.
