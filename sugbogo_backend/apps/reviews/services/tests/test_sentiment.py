"""Offline unit tests; model outputs are mocked except the packaged VADER lexicon."""

import os
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock, patch

import torch

from apps.reviews.services import sentiment as s


class SentimentTests(TestCase):
    def setUp(self):
        s._models.clear()
        self.addCleanup(s._models.clear)

    def test_clear_english_vader(self):
        for text, expected in [
            ("I absolutely love this wonderful place!", "Positive"),
            ("Horrible food and terrible service. I hate it.", "Negative"),
            ("The building has two floors.", "Neutral"),
        ]:
            with self.subTest(text=text):
                score, label = s.score_with_vader(text)
                self.assertEqual(label, expected)
                self.assertTrue(-1 <= score <= 1)

    def test_vader_boundaries(self):
        for score, label in [(-0.05, "Negative"), (0.0, "Neutral"), (0.05, "Positive")]:
            with self.subTest(score=score), patch.object(s, "_get_model") as get:
                get.return_value.polarity_scores.return_value = {"compound": score}
                self.assertEqual(s.score_with_vader("text"), (score, label))

    def test_blank_is_rejected_before_loading(self):
        with patch.object(s, "_get_model") as get:
            for function in [s.score_with_vader, s.detect_language,
                             s.score_with_tagalog_model, s.route_sentiment]:
                for text in ["", " \n\t "]:
                    with self.subTest(function=function.__name__, text=text):
                        with self.assertRaises(ValueError):
                            function(text)
            get.assert_not_called()

    def test_language_batch_whitespace_and_short_text(self):
        with patch.object(s, "_get_model") as get:
            get.return_value.predict.return_value = ([["__label__en"]], [[0.8]])
            self.assertEqual(s.detect_language(" Great\nfood "), ("en", 0.8))
            get.return_value.predict.assert_called_once_with(["Great food"], k=1)

    def test_routing_threshold_and_other_languages(self):
        cases = [("en", 0.7999, False), ("en", 0.80, True), ("en", 0.8001, True)]
        cases += [(language, 0.99, False) for language in ["tl", "fil", "ceb", "fr", "und"]]
        for language, confidence, english in cases:
            with self.subTest(language=language, confidence=confidence):
                with patch.object(s, "detect_language", return_value=(language, confidence)), \
                     patch.object(s, "score_with_vader", return_value=(0.6, "Positive")) as vader, \
                     patch.object(s, "score_with_tagalog_model", return_value=(0.4, "Positive")) as tl:
                    result = s.route_sentiment("Good")
                    self.assertEqual(result[2], "vader" if english else s.TAGALOG_MODEL_ID)
                    self.assertEqual(vader.call_count, int(english))
                    self.assertEqual(tl.call_count, int(not english))

    def test_emoji_and_other_nonletters_route_to_tagalog(self):
        for text in ["😀❤️", "!!!", "123"]:
            with self.subTest(text=text), patch.object(s, "_get_model") as get, \
                 patch.object(s, "score_with_tagalog_model", return_value=(0.3, "Positive")) as tl:
                self.assertEqual(s.route_sentiment(text), (0.3, "Positive", s.TAGALOG_MODEL_ID))
                get.assert_not_called()
                tl.assert_called_once_with(text)

    def test_mixed_language_detected_once_as_whole_review(self):
        text = "Great food pero mahal kaayo ang presyo."
        for confidence in [0.7, 0.9]:
            with patch.object(s, "detect_language", return_value=("en", confidence)) as detect, \
                 patch.object(s, "score_with_vader", return_value=(0.2, "Positive")), \
                 patch.object(s, "score_with_tagalog_model", return_value=(-0.2, "Negative")):
                self.assertEqual(s.route_sentiment(text)[2],
                                 "vader" if confidence >= 0.8 else s.TAGALOG_MODEL_ID)
                detect.assert_called_once_with(text)

    def test_tagalog_cebuano_logits_mapping_score_and_cap(self):
        cases = [
            ("Napakasarap ng pagkain!", [0.1, 0.8, 0.1], "Positive"),
            ("Dili lami ang pagkaon.", [0.8, 0.1, 0.1], "Negative"),
            ("May dalawang palapag ang gusali.", [0.1, 0.2, 0.7], "Neutral"),
            ("Pareho", [0.4, 0.4, 0.2], "Neutral"),
        ]
        for text, probabilities, expected in cases:
            with self.subTest(text=text), patch.object(s, "_get_model") as get:
                tokenizer = Mock(return_value={"input_ids": torch.tensor([[0, 2]])})
                def forward(**kwargs):
                    self.assertTrue(torch.is_inference_mode_enabled())
                    return SimpleNamespace(logits=torch.tensor([probabilities]).log())
                get.return_value = tokenizer, forward
                score, label = s.score_with_tagalog_model(text)
                self.assertEqual(label, expected)
                self.assertAlmostEqual(score, probabilities[1] - probabilities[0], places=6)
                tokenizer.assert_called_once_with(
                    text, return_tensors="pt", truncation=True, max_length=510,
                )

    def test_missing_path_and_inference_failure_propagate(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(RuntimeError):
                s._path("FASTTEXT_LID_MODEL_PATH")
        with patch.object(s, "detect_language", return_value=("tl", 0.99)), \
             patch.object(s, "score_with_tagalog_model", side_effect=RuntimeError("inference failed")), \
             patch.object(s, "score_with_vader") as vader:
            with self.assertRaisesRegex(RuntimeError, "inference failed"):
                s.route_sentiment("Masarap")
            vader.assert_not_called()

    def test_loading_is_cached_across_threads(self):
        model = object()
        with patch.object(s, "_load_model", return_value=model) as load:
            with ThreadPoolExecutor(max_workers=4) as pool:
                results = list(pool.map(s._get_model, ["vader"] * 8))
            self.assertTrue(all(result is model for result in results))
            load.assert_called_once_with("vader")
