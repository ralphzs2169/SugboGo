"""Narrow direct-threat coverage for the local Cebuano safety fallback."""

from django.test import SimpleTestCase

from apps.reviews.services.review_cebuano_safety_fallback import (
    ReviewCebuanoSafetyFallback,
)


class ReviewCebuanoSafetyFallbackTests(SimpleTestCase):
    """Only direct violent constructions should create local findings."""

    def test_direct_threats_are_attributed_to_specific_rules(self):
        cases = (
            ("Patyon nako ang mga customer.", "direct_kill_threat"),
            (
                "I love this place pero patyon nako ang mga customer.",
                "direct_kill_threat",
            ),
            ("Patyon gyud tika.", "direct_kill_threat"),
            ("Patyon jud nako na siya.", "direct_kill_threat"),
            ("Mopatay ko nimo.", "direct_kill_threat"),
            ("Mopatay gyud ko nimo.", "direct_kill_threat"),
            (
                "I love this place pero patyon gyud tika.",
                "direct_kill_threat",
            ),
            ("Pusilon tika.", "direct_shoot_threat"),
            ("Pusilon gyud tika.", "direct_shoot_threat"),
            ("Sumbagon nako siya.", "direct_punch_threat"),
            ("Sumbagon jud tika.", "direct_punch_threat"),
            ("Sumbagon gyud nako siya.", "direct_punch_threat"),
            ("  PATYON   NAKO ang customer. ", "direct_kill_threat"),
        )
        for text, expected_rule in cases:
            with self.subTest(text=text):
                finding = ReviewCebuanoSafetyFallback.finding(text)
                self.assertEqual(finding["source"], "local_cebuano_safety")
                self.assertEqual(finding["category"], "violence_threat")
                self.assertEqual(finding["matched_rule"], expected_rule)
                self.assertTrue(finding["flagged"])
                self.assertNotIn(text, str(finding))

    def test_negative_and_non_direct_language_is_not_flagged(self):
        samples = (
            "Wa ko ganahi sa service.",
            "Grabe ka bati ang pagkaon.",
            "Di nako mubalik diri.",
            "Terrible kaayo ang service.",
            "The food was good and the staff were friendly.",
            "Giingon nila nga patyon ang customer.",
            "Patyon is a word I heard, but I am describing the incident.",
            "The words 'patay', 'pusil', and 'sumbag' were mentioned in a film.",
            "Mopatay ug oras ang traffic.",
            "Patyon jud ang problema sa presyo.",
            "Dili ko mopatay nimo.",
            "Pusil and sumbag are words in the quoted article.",
        )
        for text in samples:
            with self.subTest(text=text):
                self.assertIsNone(ReviewCebuanoSafetyFallback.finding(text))
