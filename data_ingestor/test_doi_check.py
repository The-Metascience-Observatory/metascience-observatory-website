"""Tests for the ingest gate's original-DOI registry check (no network).

    cd data_ingestor && python -m pytest test_doi_check.py -q
"""
import unittest

import pandas as pd

import doi_check
from data_ingestor import extract_doi_from_url, normalize_doi


class DecodeDoi(unittest.TestCase):
    def test_url_encoded_slash_is_decoded(self):
        self.assertEqual(doi_check.decode_doi("https://doi.org/10.1177%2F10986111211035002"),
                         "10.1177/10986111211035002")
        self.assertEqual(extract_doi_from_url("https://doi.org/10.1177%2F10986111211035002"),
                         "10.1177/10986111211035002")
        self.assertEqual(normalize_doi("10.1177%2F10986111211035002"), "10.1177/10986111211035002")

    def test_parentheses_and_sici_brackets_survive(self):
        self.assertEqual(doi_check.decode_doi("https://doi.org/10.1044/1092-4388(2001/052)"),
                         "10.1044/1092-4388(2001/052)")
        sici = "10.1002/(SICI)1099-0771(199806)11:2<107::AID-BDM292>3.0.CO;2-Y"
        self.assertEqual(doi_check.decode_doi("https://doi.org/" + sici), sici)

    def test_non_doi_urls_are_ignored(self):
        self.assertIsNone(doi_check.decode_doi("https://pubmed.ncbi.nlm.nih.gov/12345/"))
        self.assertIsNone(doi_check.decode_doi(""))
        self.assertIsNone(doi_check.decode_doi(float("nan")))


class TitlesAgree(unittest.TestCase):
    def test_registry_main_title_and_punctuation_variants_agree(self):
        self.assertTrue(doi_check.titles_agree(
            "With a clean conscience: Cleanliness reduces the severity of moral judgments",
            "With a Clean Conscience"))
        self.assertTrue(doi_check.titles_agree("Ego Depletion-Is It All in Your Head?: Implicit theories",
                                               "Ego Depletion—Is It All in Your Head?"))
        self.assertTrue(doi_check.titles_agree("", "anything"))     # nothing to compare

    def test_another_paper_disagrees(self):
        self.assertFalse(doi_check.titles_agree(
            "Single letter coloring and spatial cuing eliminates a semantic contribution to the Stroop effect",
            "The serial-parallel dilemma: A case study in a linkage of theory and method"))


class CheckOriginalDois(unittest.TestCase):
    def _df(self):
        return pd.DataFrame([
            {"original_url": "https://doi.org/10.1038/scep05340", "original_title": "Novel common variants"},
            {"original_url": "https://doi.org/10.3758/BF03196588",
             "original_title": "Single letter coloring and spatial cuing eliminates a semantic contribution"},
            {"original_url": "https://doi.org/10.1038/srep05340", "original_title": "Novel common variants"},
            {"original_url": "https://doi.org/10.9999/flaky", "original_title": "Anything"},
            {"original_url": "", "original_title": "No DOI at all"},
            {"original_url": "https://doi.org/10.1038/scep05340", "original_title": "Novel common variants"},
        ])

    def test_unregistered_rejects_mismatch_flags_unknown_passes(self):
        answers = {
            "10.1038/scep05340": {"status": "unregistered", "title": ""},
            "10.3758/BF03196588": {"status": "registered", "title": "The serial-parallel dilemma"},
            "10.1038/srep05340": {"status": "registered", "title": "Novel common variants and susceptible haplotype"},
            "10.9999/flaky": {"status": "unknown", "title": ""},
        }
        calls = []

        def resolver(doi):
            calls.append(doi)
            return answers[doi]

        out = dict(doi_check.check_original_dois(self._df(), resolver=resolver, delay=0))
        self.assertEqual(sorted(out), [0, 1, 5])
        self.assertEqual(out[0][0].rule_id, "doi_unregistered")
        self.assertEqual(out[0][0].severity, "reject")
        self.assertEqual(out[1][0].rule_id, "doi_title_mismatch")
        self.assertEqual(out[1][0].severity, "flag")
        self.assertEqual(len(calls), 4)           # each distinct DOI resolved once


if __name__ == "__main__":
    unittest.main()
