"""
Data-validity rules for the replications database.

Driven by codebook_rules.json (draft codebook, GSF 2026-07-29b): the legal
range of an effect size depends entirely on its declared type, so every range
check here is keyed on the effect-size *family* of the row's es_type.

Severities:
    reject — the value is arithmetically impossible (|r| > 1, p > 1, OR <= 0,
             n = 'TESTING'...). The ingest gate refuses these rows until fixed.
    flag   — suspicious but possibly legitimate (p exactly 0, |d| > 6,
             replication predates original...). Ingested, reported, logged.
    info   — expected oddities (test-statistic strings in es columns).

Traps deliberately encoded (each would quarantine CORRECT data if ignored):
    - log ROM / log OR are signed and unbounded (86/190 log-ROM cells negative)
    - ratio families are directional by position vs 1, so a negative es_r for
      OR = 0.33 is correct, not a sign error
    - journal `issue` is a string ('7-8', 'S1') — no integer rule on it
    - AUC's null is 0.5 and it is not a variance share

Standalone audit:  python validation_rules.py <csv> [--out violations.csv]
"""

import json
import os
import re
import sys
import unicodedata
from collections import Counter
from dataclasses import dataclass

RULES_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          "codebook_rules.json")

MIN_YEAR = 1600
MAX_YEAR = 2100  # replaced by current year at runtime where available

# es_type values that legitimately hold a non-numeric test-statistic string
# (FReD keeps 'F(2, 154) = 12.47' verbatim — better provenance than a bare number)
TEST_STAT_TYPES = {"test statistic", "test-stat", "test stat"}

# Families whose es / es_r / CI share one scale with null 0, so containment and
# CI-vs-p checks are meaningful without unit information.
SAME_SCALE_NULL0_FAMILIES = {"correlation", "standardised_mean_diff",
                             "paired_smd", "log_ratio"}

VALID_RESULTS = {"success", "failure", "inconclusive", "reversal", ""}
VALID_VALIDATED = {"yes", "no", ""}
DRIFT_VALIDATED = {"partially", "partial"}
VALID_REP_TYPES = {"direct", "close experiment", "close extension",
                   "conceptual", "close", "direct or close", ""}
VALID_TAILS = {"one", "two", ""}
DRIFT_TAILS = {"one-sided", "two-sided", "two-tailed", "one-tailed"}
VALID_P_TYPES = {"=", "<", ">", "lt", ""}


@dataclass
class Violation:
    rule_id: str
    column: str
    value: str
    severity: str  # 'reject' | 'flag' | 'info'
    message: str

    def __str__(self):
        return f"[{self.severity.upper()}] {self.column} = {self.value!r} — {self.message} ({self.rule_id})"


# ---------------------------------------------------------------------------
# Rule loading and type normalisation
# ---------------------------------------------------------------------------

def _norm_type(s):
    """Normalise an es_type spelling for family lookup.

    NFKD folds superscripts (f² -> f2); Greek chi is spelled out; curly
    apostrophes become ASCII so `Hedges' g` matches `hedges' g`.
    """
    s = unicodedata.normalize("NFKD", str(s))
    s = s.replace("’", "'").replace("‘", "'")
    s = s.replace("χ", "chi").replace("Χ", "chi")
    s = re.sub(r"\s+", " ", s.strip().lower())
    return s


def load_rules(path=RULES_PATH):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def build_family_lookup(rules):
    """member spelling (normalised) -> (family name, family spec)."""
    lookup = {}
    for fam_name, spec in rules["families"].items():
        for member in spec["members"]:
            lookup[_norm_type(member)] = (fam_name, spec)
    # spellings present in the data but absent from the member lists
    extra = {
        "chi2": "nonneg_unbounded", "chi squared": "nonneg_unbounded",
        "chi-squared": "nonneg_unbounded", "chi2 statistic": "nonneg_unbounded",
        "eta^2": "variance_share", "eta-squared": "variance_share",
        "partial eta^2": "variance_share", "partial eta-squared": "variance_share",
        "r squared": "variance_share", "r-squared": "variance_share", "r^2": "variance_share",
        "f^2": "nonneg_unbounded",
        "hedges' g": "standardised_mean_diff", "hedge's g": "standardised_mean_diff",
        "hedges'g": "standardised_mean_diff", "hedgesg": "standardised_mean_diff",
    }
    for spelling, fam_name in extra.items():
        key = _norm_type(spelling)
        if key not in lookup and fam_name in rules["families"]:
            lookup[key] = (fam_name, rules["families"][fam_name])
    return lookup


def _passthrough_set(rules):
    return {_norm_type(t) for t in rules.get("pass_through_types", [])}


# ---------------------------------------------------------------------------
# Small parsers
# ---------------------------------------------------------------------------

def _s(v):
    """Value -> stripped string ('' for None/NaN)."""
    if v is None:
        return ""
    try:
        import math
        if isinstance(v, float) and math.isnan(v):
            return ""
    except Exception:
        pass
    s = str(v).strip()
    return "" if s.lower() == "nan" else s


def _float(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def parse_ci(raw):
    """Parse a packed '[lo, hi]' interval string.

    Bracket-aware and comma-based ONLY: '0.008-0.850' must NOT be read as
    lower 0.008 / upper -0.850 (the hyphen-as-minus trap), so a bare hyphen is
    never used as a separator. Returns (lo, hi), or None if unparseable.
    """
    s = _s(raw)
    if not s:
        return None
    s = s.strip("[](){}")
    parts = re.split(r"\s*[,;]\s*", s)
    if len(parts) != 2:
        parts = re.split(r"\s+to\s+", s, flags=re.IGNORECASE)
    if len(parts) != 2:
        return None
    lo, hi = _float(parts[0]), _float(parts[1])
    if lo is None or hi is None:
        return None
    return lo, hi


def _norm_doi(url):
    s = _s(url).lower()
    s = re.sub(r"^https?://(dx\.)?doi\.org/", "", s).rstrip("/")
    # legacy APA DOIs are registered with doubled slashes (10.1037//...)
    return re.sub(r"/{2,}", "/", s)


# ---------------------------------------------------------------------------
# The validator
# ---------------------------------------------------------------------------

class RowValidator:
    def __init__(self, rules_path=RULES_PATH, current_year=None):
        self.rules = load_rules(rules_path)
        self.families = build_family_lookup(self.rules)
        self.pass_through = _passthrough_set(self.rules)
        if current_year is None:
            import datetime
            current_year = datetime.date.today().year
        self.current_year = current_year

    # -- helpers ----------------------------------------------------------
    def family_of(self, es_type):
        t = _norm_type(es_type)
        if not t:
            return None, None, False
        if t in TEST_STAT_TYPES:
            return None, None, True
        fam = self.families.get(t)
        if fam:
            return fam[0], fam[1], False
        return None, None, False

    # -- per-side checks --------------------------------------------------
    def _check_side(self, row, side, out):
        pre = side + "_"
        es_raw = _s(row.get(pre + "es"))
        es_type = _s(row.get(pre + "es_type"))
        es_r_raw = _s(row.get(pre + "es_r"))
        fam_name, fam, is_test_stat = self.family_of(es_type)
        es = _float(es_raw)
        es_r = _float(es_r_raw)

        # effect size vs its family's legal range
        if es_raw and es is None:
            if is_test_stat:
                out.append(Violation("es_test_stat_string", pre + "es", es_raw, "info",
                                     "test-statistic string kept verbatim (FReD convention)"))
            else:
                out.append(Violation("es_nonnumeric", pre + "es", es_raw, "flag",
                                     f"non-numeric effect size for type '{es_type or '(blank)'}'"))
        elif es is not None and fam is not None:
            lo, hi = fam.get("lo"), fam.get("hi")
            strict_lo = fam.get("strict_lo", False)
            if fam_name in ("correlation", "cramers_v") and abs(es) > 1:
                out.append(Violation("es_range_correlation", pre + "es", es_raw, "reject",
                                     f"a {es_type} cannot exceed 1 in magnitude (legal range [-1, 1])"))
            elif fam_name == "ratio" and es <= 0:
                out.append(Violation("es_range_ratio", pre + "es", es_raw, "reject",
                                     f"a {es_type} is strictly positive (null is 1, not 0)"))
            elif fam_name in ("variance_share", "probability_of_superiority") and not (0 <= es <= 1):
                out.append(Violation("es_range_unit_interval", pre + "es", es_raw, "reject",
                                     f"a {es_type} must lie in [0, 1]"))
            elif fam_name == "nonneg_unbounded":
                if es < 0:
                    out.append(Violation("es_range_nonneg", pre + "es", es_raw, "reject",
                                         f"a {es_type} is non-negative by construction"))
                elif fam.get("soft_hi") is not None and es > fam["soft_hi"]:
                    out.append(Violation("es_above_soft_hi", pre + "es", es_raw, "flag",
                                         f"{es_type} > 1 is legal only up to sqrt(k-1); verify table dimensions"))
            elif fam.get("implausible_abs") is not None and abs(es) > fam["implausible_abs"]:
                out.append(Violation("es_implausible_magnitude", pre + "es", es_raw, "flag",
                                     f"|{es_type}| > {fam['implausible_abs']} is possible but should be verified"))
            elif lo is not None and (es < lo or (strict_lo and es == lo)):
                out.append(Violation("es_below_lo", pre + "es", es_raw, "reject",
                                     f"below the legal minimum {lo} for {es_type}"))
            elif hi is not None and es > hi:
                out.append(Violation("es_above_hi", pre + "es", es_raw, "reject",
                                     f"above the legal maximum {hi} for {es_type}"))
        elif es is not None and es_type and fam is None and not is_test_stat:
            out.append(Violation("es_type_unmapped", pre + "es_type", es_type, "flag",
                                 "effect-size type matches no known family; range rules cannot check it"))

        # converted correlation
        if es_r is not None:
            if abs(es_r) > 1:
                out.append(Violation("esr_range", pre + "es_r", es_r_raw, "reject",
                                     "a converted Pearson r must lie in [-1, 1]"))
            elif fam is not None:
                if fam_name == "uninterpretable_without_units":
                    out.append(Violation("esr_from_unitless", pre + "es_r", es_r_raw, "flag",
                                         f"'{es_type}' is in arbitrary units and should not populate es_r"))
                elif not fam.get("directional", True) and es_r < 0:
                    out.append(Violation("esr_invented_sign", pre + "es_r", es_r_raw, "flag",
                                         f"'{es_type}' carries no direction; a negative es_r is an invented sign"))
                if (_norm_type(es_type) in self.pass_through and es is not None
                        and abs(es_r - es) > 0.01):
                    out.append(Violation("esr_passthrough_mismatch", pre + "es_r", es_r_raw, "flag",
                                         f"type '{es_type}' should pass through unchanged, but es = {es_raw}"))
        elif es_r_raw:
            out.append(Violation("esr_nonnumeric", pre + "es_r", es_r_raw, "flag",
                                 "non-numeric converted effect size"))

        # p-value
        p_raw = _s(row.get(pre + "p_value"))
        p = _float(p_raw)
        if p_raw and p is None:
            out.append(Violation("p_nonnumeric", pre + "p_value", p_raw, "flag",
                                 "non-numeric p-value"))
        elif p is not None:
            if p < 0 or p > 1:
                out.append(Violation("p_range", pre + "p_value", p_raw, "reject",
                                     "a p-value must be between 0 and 1"))
            elif p == 0:
                out.append(Violation("p_exactly_zero", pre + "p_value", p_raw, "flag",
                                     "p = 0 is not possible for a continuous statistic (rounding artifact)"))

        # p-value type / tails spellings
        pvt = _s(row.get(pre + "p_value_type")).lower()
        if pvt not in VALID_P_TYPES:
            out.append(Violation("p_type_not_comparator", pre + "p_value_type",
                                 _s(row.get(pre + "p_value_type")), "flag",
                                 "expected a comparator (= < >); holds a test name or free text"))
        tails = _s(row.get(pre + "p_value_tails")).lower()
        if tails and tails not in VALID_TAILS:
            sev_msg = ("known variant spelling; normalise to one|two"
                       if tails in DRIFT_TAILS else "unknown tails value")
            out.append(Violation("tails_spelling", pre + "p_value_tails", tails, "flag", sev_msg))

        # sample size
        n_raw = _s(row.get(pre + "n"))
        n = _float(n_raw)
        if n_raw and n is None:
            out.append(Violation("n_nonnumeric", pre + "n", n_raw, "reject",
                                 "sample size is not a number"))
        elif n is not None:
            if n <= 0:
                out.append(Violation("n_nonpositive", pre + "n", n_raw, "reject",
                                     "sample size must be positive"))
            else:
                if abs(n - round(n)) > 1e-9:
                    out.append(Violation("n_fractional", pre + "n", n_raw, "flag",
                                         "sample size should be a whole number"))
                if n < 2:
                    out.append(Violation("n_uninformative", pre + "n", n_raw, "flag",
                                         "n < 2 is uninformative"))
                elif n > 100000:
                    out.append(Violation("n_very_large", pre + "n", n_raw, "flag",
                                         "n > 100,000 — legitimate for GWAS/pooled analyses, verify"))

        # year
        y_raw = _s(row.get(pre + "year"))
        y = _float(y_raw)
        if y_raw and y is None:
            out.append(Violation("year_nonnumeric", pre + "year", y_raw, "flag",
                                 "non-numeric year"))
        elif y is not None and not (MIN_YEAR <= y <= self.current_year):
            out.append(Violation("year_range", pre + "year", y_raw, "reject",
                                 f"year must be between {MIN_YEAR} and {self.current_year}"))

        # confidence interval
        ci_raw = _s(row.get(pre + "es_95_CI"))
        if ci_raw:
            ci = parse_ci(ci_raw)
            if ci is None:
                out.append(Violation("ci_unparseable", pre + "es_95_CI", ci_raw, "flag",
                                     "cannot parse as [lower, upper] (comma-separated); not guessing at hyphens"))
            else:
                lo_ci, hi_ci = ci
                if lo_ci > hi_ci:
                    out.append(Violation("ci_inverted", pre + "es_95_CI", ci_raw, "reject",
                                         "interval lower bound exceeds upper bound"))
                elif fam_name in SAME_SCALE_NULL0_FAMILIES:
                    if es is not None and not (lo_ci - 0.01 <= es <= hi_ci + 0.01):
                        out.append(Violation("ci_excludes_estimate", pre + "es_95_CI", ci_raw, "flag",
                                             f"interval does not contain its own estimate ({es_raw})"))
                    if p is not None and (lo_ci > 0 or hi_ci < 0) and p >= 0.05:
                        out.append(Violation("ci_p_contradiction", pre + "es_95_CI", ci_raw, "flag",
                                             f"interval excludes the null yet p = {p_raw} >= 0.05"))

    # -- whole-row checks -------------------------------------------------
    def validate_row(self, row):
        """row: mapping column -> value. Returns a list of Violations."""
        out = []
        for side in ("original", "replication"):
            self._check_side(row, side, out)

        # DOI checks
        for col in ("original_url", "replication_url"):
            raw = _s(row.get(col))
            if raw and len(re.findall(r"doi\.org/", raw)) > 1:
                out.append(Violation("doi_doubled_prefix", col, raw, "reject",
                                     "doubled DOI resolver prefix"))
        o, r = _norm_doi(row.get("original_url")), _norm_doi(row.get("replication_url"))
        if o and r and o == r:
            out.append(Violation("doi_self_pair", "replication_url", _s(row.get("replication_url")),
                                 "reject", "original and replication resolve to the same DOI"))

        # year ordering (flag, not reject: preprint vs journal dates are legitimate)
        oy, ry = _float(_s(row.get("original_year"))), _float(_s(row.get("replication_year")))
        if oy is not None and ry is not None and ry < oy:
            out.append(Violation("replication_predates_original", "replication_year",
                                 _s(row.get("replication_year")), "flag",
                                 f"replication year precedes original ({int(oy)}); check preprint vs journal dates"))

        # enums
        res = _s(row.get("result")).lower()
        if res not in VALID_RESULTS:
            out.append(Violation("result_unknown_value", "result", _s(row.get("result")), "flag",
                                 "not one of success|failure|inconclusive|reversal"))
        val = _s(row.get("validated")).lower()
        if val in DRIFT_VALIDATED:
            out.append(Violation("validated_spelling", "validated", val, "flag",
                                 "variant spelling; schema declares yes|no"))
        elif val not in VALID_VALIDATED:
            out.append(Violation("validated_unknown_value", "validated", val, "flag",
                                 "not one of yes|no"))
        rt = _s(row.get("replication_type")).lower()
        if rt not in VALID_REP_TYPES:
            out.append(Violation("replication_type_unknown", "replication_type", rt, "flag",
                                 "outside the declared replication-type vocabulary"))

        if not res and val == "yes":
            out.append(Violation("validated_without_result", "result", "", "flag",
                                 "blank result on a human-validated row"))

        # result vs the row's own replication p-value, honoring the comparator:
        # '< 0.05' certifies significance, '> x' certifies non-significance only
        # when x >= 0.05; a bound in the other direction proves nothing.
        rp = _float(_s(row.get("replication_p_value")))
        if rp is not None:
            cmp_ = _s(row.get("replication_p_value_type")).lower()
            cmp_ = "<" if cmp_ == "lt" else cmp_
            certainly_nonsig = (rp >= 0.05 and cmp_ in ("=", "", ">"))
            certainly_sig = (rp < 0.05 and cmp_ in ("=", "")) or (rp <= 0.05 and cmp_ == "<")
            if res == "success" and certainly_nonsig:
                out.append(Violation("result_p_contradiction", "result", res, "flag",
                                     f"coded success but replication p = {rp:g} >= 0.05"))
            elif res == "failure" and certainly_sig:
                out.append(Violation("result_p_contradiction", "result", res, "flag",
                                     f"coded failure but replication p = {rp:g} < 0.05"))

        return out

    def validate_dataframe(self, df):
        """Return list of (df index, [Violations]) for rows with any violation."""
        results = []
        for idx, row in df.iterrows():
            v = self.validate_row(row)
            if v:
                results.append((idx, v))
        return results


def has_rejects(violations):
    return any(v.severity == "reject" for v in violations)


# ---------------------------------------------------------------------------
# Standalone audit mode
# ---------------------------------------------------------------------------

def main(argv):
    import pandas as pd

    if len(argv) < 2:
        print(__doc__)
        return 2
    csv_path = argv[1]
    out_path = None
    if "--out" in argv:
        out_path = argv[argv.index("--out") + 1]

    df = pd.read_csv(csv_path, dtype=str, keep_default_na=False)
    validator = RowValidator()
    results = validator.validate_dataframe(df)

    by_rule = Counter()
    by_sev = Counter()
    examples = {}
    reject_rows = 0
    records = []
    for idx, violations in results:
        if has_rejects(violations):
            reject_rows += 1
        for v in violations:
            by_rule[(v.severity, v.rule_id)] += 1
            by_sev[v.severity] += 1
            examples.setdefault(v.rule_id, (idx, v))
            records.append({"row_index": idx, "csv_line": idx + 2, "rule": v.rule_id,
                            "severity": v.severity, "column": v.column,
                            "value": v.value, "message": v.message})

    print(f"\n{os.path.basename(csv_path)}: {len(df)} rows")
    print(f"rows with any violation: {len(results)}  |  rows with a REJECT: {reject_rows}")
    print(f"violations by severity: " + ", ".join(f"{k}={v}" for k, v in sorted(by_sev.items())))
    print(f"\n{'severity':8s} {'rule':32s} {'count':>6s}   example (csv line)")
    order = {"reject": 0, "flag": 1, "info": 2}
    for (sev, rule), count in sorted(by_rule.items(), key=lambda kv: (order[kv[0][0]], -kv[1])):
        ex_idx, ex = examples[rule]
        ex_val = ex.value if len(str(ex.value)) <= 28 else str(ex.value)[:25] + "..."
        print(f"{sev:8s} {rule:32s} {count:6d}   {ex.column}={ex_val!r} (line {ex_idx + 2})")

    if out_path:
        pd.DataFrame(records).to_csv(out_path, index=False)
        print(f"\nwrote {len(records)} violation records to {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
