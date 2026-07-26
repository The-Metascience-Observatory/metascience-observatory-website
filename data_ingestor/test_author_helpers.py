"""
Tests for author-name helper functions in fetch_metadata_from_doi.py

Run:  python3 test_author_helpers.py
  or: python3 -m unittest test_author_helpers -v
"""

import unittest
from fetch_metadata_from_doi import (
    _is_initial_token,
    _count_full_first_names,
    _authors_have_abbreviations,
    _new_authors_are_better,
)
from author_case import standardize_author_name, standardize_authors_cell


class TestIsInitialToken(unittest.TestCase):
    """Tokens with periods are initials up to 3 chars; without periods only bare
    single uppercase letters count.  Short real names (JAN, KIM, TOM) must NOT
    be flagged."""

    def test_single_letter(self):
        self.assertTrue(_is_initial_token("J"))

    def test_single_letter_with_period(self):
        self.assertTrue(_is_initial_token("J."))

    def test_compound_dotted(self):
        self.assertTrue(_is_initial_token("A.C."))
        self.assertTrue(_is_initial_token("J.K."))
        self.assertTrue(_is_initial_token("J.L."))

    def test_short_real_names_not_flagged(self):
        for name in ("JAN", "KIM", "TOM", "BOB", "DAN"):
            with self.subTest(name=name):
                self.assertFalse(_is_initial_token(name))

    def test_normal_names_not_flagged(self):
        for name in ("John", "Smith", "Alice"):
            with self.subTest(name=name):
                self.assertFalse(_is_initial_token(name))

    def test_two_char_no_period_not_flagged(self):
        for token in ("LA", "AB", "JK"):
            with self.subTest(token=token):
                self.assertFalse(_is_initial_token(token))

    def test_empty_string(self):
        self.assertTrue(_is_initial_token(""))

    def test_period_only(self):
        self.assertTrue(_is_initial_token("."))


class TestCountFullFirstNames(unittest.TestCase):
    """Handles three formats: "Last, Given", "Given Last", and "Last FI"
    (PubMed/EuropePMC style, detected when last token is an initial)."""

    def test_comma_format_full(self):
        self.assertEqual(
            _count_full_first_names("Williams, Lawrence; Bargh, John"), (2, 2))

    def test_comma_format_abbreviated(self):
        self.assertEqual(
            _count_full_first_names("Smith, J.; Jones, M."), (0, 2))

    def test_given_last_full(self):
        self.assertEqual(
            _count_full_first_names("John Smith; Jane Doe"), (2, 2))

    def test_given_last_abbreviated(self):
        self.assertEqual(
            _count_full_first_names("J. Smith; M. Jones"), (0, 2))

    def test_last_fi_single_initial(self):
        # "Smith J." → last token "J." is initial → Last FI detected
        self.assertEqual(
            _count_full_first_names("Smith J.; Wälchli M"), (0, 2))

    def test_last_fi_compound_initials_not_detected(self):
        # "Williams LA" → "LA" is NOT flagged as initial (2-char, no period)
        self.assertEqual(_count_full_first_names("Williams LA"), (1, 1))

    def test_category_b_initial_plus_middle(self):
        # "J. Lukas Thürmer" → first token "J." is initial → abbreviated
        self.assertEqual(
            _count_full_first_names("J. Lukas Thürmer; Roy Baumeister"), (1, 2))

    def test_full_names_with_middle_initials(self):
        self.assertEqual(
            _count_full_first_names("Lawrence E. Williams; John A. Bargh"), (2, 2))

    def test_empty_and_none(self):
        self.assertEqual(_count_full_first_names(""), (0, 0))
        self.assertEqual(_count_full_first_names(None), (0, 0))
        self.assertEqual(_count_full_first_names("NaN"), (0, 0))

    def test_all_caps_short_names_are_full(self):
        self.assertEqual(_count_full_first_names("JAN RUFFIEUX"), (1, 1))

    def test_mixed_formats(self):
        self.assertEqual(
            _count_full_first_names("JAN RUFFIEUX; Smith J."), (1, 2))


class TestAuthorsHaveAbbreviations(unittest.TestCase):

    def test_all_full(self):
        self.assertFalse(_authors_have_abbreviations("John Smith; Jane Doe"))

    def test_some_abbreviated(self):
        self.assertTrue(_authors_have_abbreviations("John Smith; J. Doe"))

    def test_last_fi_format(self):
        self.assertTrue(_authors_have_abbreviations("Smith J.; Jones M."))

    def test_empty(self):
        self.assertFalse(_authors_have_abbreviations(""))
        self.assertFalse(_authors_have_abbreviations(None))


class TestNewAuthorsAreBetter(unittest.TestCase):
    """Normal comparison: accept if more full names AND author count >= 70%.
    Quality override: accept smaller lists (50–70% of original count) if the
    new list is >= 90% full names."""

    ABBREV_10 = "A. B; C. D; E. F; G. H; I. J; K. L; M. N; O. P; Q. R; S. T"
    FULL_9 = ("Alice Brown; Carol Davis; Edward Fox; George Hill; "
              "Ivan Jones; Kevin Lee; Mary Nash; Oscar Park; Quinn Reed")
    FULL_5 = "Alice Brown; Carol Davis; Edward Fox; George Hill; Ivan Jones"
    FULL_4 = "Alice Brown; Carol Davis; Edward Fox; George Hill"
    MIXED_6 = "Alice Brown; A. B; Carol Davis; C. D; Edward Fox; E. F"

    def test_empty_new_rejected(self):
        self.assertFalse(_new_authors_are_better("John Smith", ""))
        self.assertFalse(_new_authors_are_better("John Smith", None))

    def test_empty_current_always_accepts(self):
        self.assertTrue(_new_authors_are_better("", "John Smith"))
        self.assertTrue(_new_authors_are_better(None, "John Smith"))

    def test_normal_path_more_full_names(self):
        # 9/9 vs 0/10: 9 >= 0.7*10, and 9 > 0 → accept
        self.assertTrue(_new_authors_are_better(self.ABBREV_10, self.FULL_9))

    def test_normal_path_no_improvement(self):
        self.assertFalse(
            _new_authors_are_better("John Smith; Jane Doe",
                                    "Alice Brown; Bob Clark"))

    def test_quality_override_accepts(self):
        # 5/5 vs 0/10: 5 < 7, but 5 >= 5 and 100% >= 90% → accept
        self.assertTrue(_new_authors_are_better(self.ABBREV_10, self.FULL_5))

    def test_quality_override_rejects_too_few(self):
        # 4/4 vs 0/10: 4 < 5 → reject even at 100% quality
        self.assertFalse(_new_authors_are_better(self.ABBREV_10, self.FULL_4))

    def test_quality_override_rejects_low_quality(self):
        # 3/6 vs 0/10: 6 < 7, but 50% < 90% → reject
        self.assertFalse(_new_authors_are_better(self.ABBREV_10, self.MIXED_6))


class TestStandardizeAuthorCase(unittest.TestCase):
    """Case standardization from author_case.py: ALL-CAPS and all-lowercase
    names become proper case; orgs, initials blocks, credentials, Roman
    numerals and already-proper names are untouched."""

    def test_allcaps_simple(self):
        self.assertEqual(standardize_author_name("JAMES R. BEEBE"), "James R. Beebe")

    def test_allcaps_surname_only(self):
        self.assertEqual(standardize_author_name("Eddy NAHMIAS"), "Eddy Nahmias")

    def test_mc_prefix(self):
        self.assertEqual(standardize_author_name("SEAN MCCREA"), "Sean McCrea")

    def test_hyphen_compound(self):
        self.assertEqual(
            standardize_author_name("MILA AMERINE-DICKENS"), "Mila Amerine-Dickens")

    def test_apostrophe(self):
        self.assertEqual(standardize_author_name("PATRICK O'BRIEN"), "Patrick O'Brien")

    def test_diacritics(self):
        self.assertEqual(
            standardize_author_name("HELGE ARNULF SØLVBERG"), "Helge Arnulf Sølvberg")

    def test_all_lowercase(self):
        self.assertEqual(standardize_author_name("dean mobbs"), "Dean Mobbs")

    def test_roman_numeral_suffix(self):
        self.assertEqual(standardize_author_name("JOHN DOE III"), "John Doe III")

    def test_trailing_initials_kept(self):
        # vowel-free trailing block is always initials
        self.assertEqual(standardize_author_name("ASCH SE"), "Asch SE")
        self.assertEqual(standardize_author_name("MCGUIRE WJ"), "McGuire WJ")

    def test_caps_surname_not_mistaken_for_initials(self):
        # vowel-bearing trailing block outside an initials-style cell
        self.assertEqual(standardize_author_name("Yu KOU"), "Yu Kou")

    def test_org_names_untouched(self):
        for org in (
            "The COVID-19 Host Genetics Initiative",
            "Avon Longitudinal Study of Parents and Children (ALSPAC)",
            "Open Science Collaboration",
        ):
            self.assertEqual(standardize_author_name(org), org)

    def test_et_al_untouched(self):
        self.assertEqual(standardize_author_name("et al."), "et al.")

    def test_credentials_untouched(self):
        self.assertEqual(
            standardize_author_name("CCC-SLP Steven B. Leder PhD"),
            "CCC-SLP Steven B. Leder PhD")

    def test_proper_names_untouched(self):
        for name in ("J. Lukas Thürmer", "Leander de Schutter", "ZoAnn E. Dreyer"):
            self.assertEqual(standardize_author_name(name), name)

    def test_cell_initials_context(self):
        # >= 2 "Surname ABC" names in the cell: vowel-bearing blocks are
        # initials too (ACE), and everything keeps its block
        cell = "Brown GDA; Lawrence ACE; van Aert RCM"
        self.assertEqual(standardize_authors_cell(cell), cell)

    def test_cell_mixed(self):
        self.assertEqual(
            standardize_authors_cell("JAMES R. BEEBE; WESLEY BUCKWALTER"),
            "James R. Beebe; Wesley Buckwalter")

    def test_cell_non_string_passthrough(self):
        self.assertIsNone(standardize_authors_cell(None))
        self.assertEqual(standardize_authors_cell(""), "")
        nan = float("nan")
        self.assertIs(standardize_authors_cell(nan), nan)


if __name__ == "__main__":
    unittest.main(verbosity=2)
