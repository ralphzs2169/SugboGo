# Review insights quality evaluation

This evaluation measures whether the review-insights pipeline is useful and
trustworthy on representative English, Filipino, Cebuano, and mixed-language
reviews. It does not write reviews, summaries, or other application data.

The bundled cases are an initial engineering corpus. A Filipino and Cebuano
speaker should review the labels and translations before the results are used
as final research evidence.

## What the command measures

The default evaluation runs the configured fastText language detector, VADER,
and local Tagalog sentiment model. It reports:

- Overall sentiment accuracy and macro F1
- Accuracy per language group
- Language-routing accuracy
- A positive/neutral/negative confusion matrix
- Every misclassified or incorrectly routed case
- Model-loading or inference errors as explicit failures

The opt-in Gemini evaluation reports:

- Keyword-theme precision, recall, and F1 against expected recurring themes
- Forbidden or unsupported theme hits
- Review IDs cited outside the expected supporting set
- The generated narrative and its cited review text for human review

Narrative faithfulness remains a human-reviewed result. Valid review IDs prove
that the model cited supplied evidence; they do not prove that every sentence
accurately represents that evidence.

## Run local sentiment evaluation

From `sugbogo_backend`:

```bash
python manage.py evaluate_review_insights --output ../docs/evidence/review-insights-evaluation.json
```

This requires valid `FASTTEXT_LID_MODEL_PATH` and
`TAGALOG_SENTIMENT_MODEL_PATH` values. It does not require Gemini or a database.

To use a proposed accuracy gate after the team approves a threshold:

```bash
python manage.py evaluate_review_insights --fail-under-sentiment-accuracy 0.80
```

Do not treat `0.80` as an approved target until the team reviews the corpus,
class balance, and expected use of neutral labels.

## Run live Gemini scenarios

Live evaluation is deliberately opt-in because it sends the synthetic reviews
to the configured provider and consumes API quota:

```bash
python manage.py evaluate_review_insights --include-live-gemini --gemini-runs-per-scenario 3 --output ../docs/evidence/review-insights-live-evaluation.json
```

Three runs per scenario allow the report to compare the stability of matched
keyword themes. Increase the run count only after reviewing quota and cost.

To run only the live generation scenarios:

```bash
python manage.py evaluate_review_insights --skip-sentiment --include-live-gemini
```

The live JSON report includes a human-review section for each scenario. Review
the narrative against the displayed cited text and answer all rubric questions
before marking narrative faithfulness complete in the tracker.

## Interpreting results

Keep routing failures separate from classification failures:

- A Filipino, Cebuano, or mixed review routed to VADER indicates a routing
  policy or language-detection problem.
- A correctly routed review with the wrong label indicates a sentiment-model
  quality problem.
- A generated tag without an expected recurring concept reduces keyword
  precision.
- A missing expected concept reduces keyword recall.
- A valid citation with an inaccurate claim remains a narrative-faithfulness
  problem and must be recorded during human review.

The evaluation report is evidence for a tuning decision. It does not modify
model thresholds, prompts, or production behavior by itself.
