# Discovery Score Documentation

## 1. Overview

The **Discovery Score** is SugboGo’s scoring system for deciding which businesses should appear higher in the **Hidden Gems** section.

Its goal is to balance two things:

**Specialty Score (SC)** — how strongly explorers support the business’s specialties.

**Visibility Gap (VG)** — how underexposed the business is compared with similar businesses.

The final Discovery Score is:

$$
DS = (0.80 \times SC) + (0.20 \times VG)
$$

The implementation combines the Specialty Score and Visibility Gap using configurable weights and keeps the result between `0` and `1`. 

In simple terms:

> **Businesses with strong specialty support receive a higher score, while businesses that have received less visibility are given a smaller opportunity boost.**

---

## 2. How the Discovery Score Works

The system can be viewed as:

```text
Explorer Activity
      │
      ├──────── Specialty Vouches
      │               ↓
      │        Specialty Score
      │
      └──────── Visibility Activity
               • Impressions
               • Profile Visits
               • Saves
                       ↓
                Visibility Gap

Specialty Score + Visibility Gap
                ↓
          Discovery Score
                ↓
           Hidden Gems
```

The current default weights are:

| Component       | Weight |
| --------------- | -----: |
| Specialty Score |    80% |
| Visibility Gap  |    20% |

This means **specialty credibility is the main factor**, while visibility acts as a smaller balancing factor.

---

# 3. Specialty Score

The **Specialty Score** measures how much valid explorer evidence supports the specialties associated with a business.

Each business is expected to have **three active specialty tags**. The system calculates a separate **Tag Score** for each specialty and then averages the three scores. The service explicitly uses an expected active-specialty count of `3`. 

For example:

```text
Business: Cebu Brew House

Specialties:
Local Coffee       → 0.82
Desserts           → 0.61
Brunch             → 0.74

Specialty Score
= (0.82 + 0.61 + 0.74) / 3

= 0.7233
```

The implementation divides the total Tag Scores by the expected three specialties. 

---

## 4. What Gives a Specialty Evidence?

A **valid specialty vouch** provides evidence for a specialty.

For example:

```text
Explorer visits Cebu Brew House

They vouch for:
"Local Coffee"

        ↓

The Local Coffee Tag Score
receives additional evidence.
```

Only vouches where:

```text
VOUCH_EVIDENCE_IS_VALID = True
```

are included when Tag Scores are recalculated. 

A user can also only vouch once for the same:

```text
Business + Explorer + Specialty
```

because the database enforces that combination as unique.

---

# 5. Reputation Snapshot

Not every vouch contributes equally.

When an explorer submits a vouch, SugboGo stores their **reputation at the exact time the vouch was made**.

```text
Explorer Reputation
        ↓
Vouch Created
        ↓
Reputation Snapshot Stored
```

This is important because the same vouch also rewards the explorer afterward.

The order is:

```text
1. Read current reputation
2. Store it in VOUCH_REPUTATION_SNAPSHOT
3. Create the vouch
4. Apply the reputation reward
```

This prevents a vouch from increasing its **own** scoring strength.

Example:

```text
Explorer reputation before vouch = 0.40

Vouch reputation snapshot = 0.40

Explorer receives reward afterward
New reputation = 0.41

But that existing vouch still uses 0.40.
```

This makes past evidence stable and explainable.

---

# 6. Evidence Contribution

Each valid vouch produces a contribution.

The formula is:

$$
Contribution =
ReputationSnapshot
\times Decay
\times Dampening
$$

The implementation directly multiplies these three factors. 

So a vouch contributes more when:

```text
the explorer has good reputation
+
the vouch is recent
+
the specialty has not already accumulated too much evidence
```

---

# 7. Evidence Decay

Older evidence gradually becomes less influential.

SugboGo uses:

$$
Decay = e^{-0.10m}
$$

where:

```text
m = age of the vouch in approximately 30-day months
```

The default decay rate is:

```text
0.10
```

The implementation converts elapsed time into fractional 30-day months and applies exponential decay. 

This means a vouch does **not suddenly expire**.

Instead:

```text
New vouch
→ strong contribution

Older vouch
→ slightly weaker contribution

Much older vouch
→ continues contributing, but less
```

This helps the score reflect more recent explorer experiences.

---

# 8. Evidence Dampening

SugboGo also prevents a specialty from growing too quickly simply because it receives many vouches.

The formula is:

$$
Dampening =
\frac{1}{\sqrt{1+n}}
$$

where:

```text
n = number of previous valid interactions
```

The implementation applies this based on the ordered position of each valid piece of evidence. 

Example:

| Evidence | Dampening |
| -------- | --------: |
| 1st      |      1.00 |
| 2nd      |     ~0.71 |
| 3rd      |     ~0.58 |
| 4th      |      0.50 |

This means early evidence matters strongly, while additional evidence continues helping with gradually smaller contributions.

---

# 9. Tag Score

All valid contributions for one specialty are added together:

$$
RawTagEvidence = \sum Contribution
$$

The raw evidence is then converted into a score using:

$$
TagScore = 1 - e^{-RawTagEvidence}
$$

This is exactly how the current Specialty Score service calculates the Tag Score. 

This formula naturally slows down as the score gets higher.

For example:

| Raw Evidence | Approx. Tag Score |
| -----------: | ----------------: |
|         0.10 |              0.10 |
|         0.50 |              0.39 |
|         1.00 |              0.63 |
|         2.00 |              0.86 |
|         3.00 |              0.95 |

This prevents a specialty from growing without limit.

The score stays between:

```text
0.00 and 1.00
```

---

# 10. Visibility Gap

The **Visibility Gap** measures how underexposed a business has been recently.

It uses activity from the most recent:

```text
30 days
```

The three signals are:

| Visibility Signal | Weight |
| ----------------- | -----: |
| Impressions       |    60% |
| Profile Visits    |    20% |
| Unique Savers     |    20% |

Visibility events are stored separately and include impressions, profile visits, and saves. 

---

# 11. Visibility Event Deduplication

SugboGo prevents repeated activity from artificially inflating visibility.

The stored deduplication key includes:

```text
Event Type
Explorer
Business
Day
```

Conceptually:

```text
IMPRESSION : Explorer 10 : Business 25 : 2026-09-14
```

If the same explorer triggers that same event again for the same business on the same day, it is treated as a duplicate.

The service constructs the key from event type, explorer ID, business ID, and event day. 

This helps prevent repeated scrolling or repeatedly opening the same business from unfairly increasing its visibility.

---

# 12. Comparison Groups

A business should not always be compared against every business on SugboGo.

The system first tries to compare businesses against others that are reasonably similar.

The order is:

```text
Category
   ↓
If fewer than 5 businesses

Cluster
   ↓
If fewer than 5 businesses

Entire Platform
```

This fallback behavior is implemented directly by the Visibility Gap service. 

Example:

```text
Business:
Cebu Brew House

Category:
Coffee Shop

If Coffee Shop has at least 5 active businesses:
→ compare within Coffee Shop

Otherwise:

Food & Culinary cluster has at least 5:
→ compare within Food & Culinary

Otherwise:
→ compare against all active businesses
```

This avoids comparing a small niche category using an unreliable sample.

---

# 13. Normalizing Visibility

For each signal, the business is compared against the **highest value in its comparison group**.

For example:

```text
Highest impressions in group = 1,000

Business impressions = 400

Normalized Impressions
= 400 / 1,000
= 0.40
```

The current implementation uses:

$$
NormalizedSignal =
\frac{BusinessSignal}{MaximumGroupSignal}
$$

If the maximum for a signal is zero, its normalized value becomes zero. 

This is an important implementation detail: the current system uses **group-maximum normalization**, not percentile ranking.

---

# 14. Traction

The normalized visibility signals are combined into a **Traction Score**:

$$
Traction =
0.60(I)
+
0.20(P)
+
0.20(S)
$$

where:

```text
I = normalized impressions
P = normalized profile visits
S = normalized unique savers
```

The service calculates traction using the configured weights. 

Example:

```text
Normalized Impressions = 0.40
Normalized Visits      = 0.50
Normalized Saves       = 0.25

Traction =
(0.60 × 0.40)
+ (0.20 × 0.50)
+ (0.20 × 0.25)

= 0.39
```

---

# 15. Calculating Visibility Gap

Visibility Gap is simply the opposite of traction:

$$
VG = 1 - Traction
$$

So:

```text
High traction
→ Low Visibility Gap

Low traction
→ High Visibility Gap
```

Using the previous example:

```text
Traction = 0.39

Visibility Gap
= 1 - 0.39
= 0.61
```

The service implements exactly this inverse calculation. 

The meaning is straightforward:

> A business that has received less exposure gets a larger Visibility Gap.

---

# 16. Final Discovery Score

Once both components are available:

```text
Specialty Score
Visibility Gap
```

SugboGo calculates:

$$
DS = 0.80(SC) + 0.20(VG)
$$

Example:

```text
Specialty Score = 0.72
Visibility Gap  = 0.61

Discovery Score =
(0.80 × 0.72)
+
(0.20 × 0.61)

= 0.576 + 0.122

= 0.698
```

So the business receives approximately:

```text
Discovery Score = 0.698
```

The score is stored to five decimal places and constrained between `0` and `1`. 

---

# 17. Score Storage

SugboGo stores one current Discovery Score record for each business.

The record contains:

| Stored Value    | Meaning                            |
| --------------- | ---------------------------------- |
| Specialty Score | Current SC                         |
| Visibility Gap  | Current VG                         |
| Discovery Score | Final DS                           |
| Computed At     | When the calculation was performed |

The scoring service creates the record when none exists and updates the existing record on later recomputations. 

Individual specialty Tag Scores are stored separately on the business-specialty relationship.

This means SugboGo does **not need to recalculate the full algorithm every time somebody opens Explore**.

---

# 18. Daily Recalculation

Discovery Scores are automatically refreshed every day.

The configured schedule is:

```text
Every day
2:00 AM
```

The workflow is:

```text
Celery Beat
    ↓
recompute_discovery_scores
    ↓
Celery Worker
    ↓
Calculate current scores
for active businesses
    ↓
Store updated scores
```

Redis is used as the Celery task broker.

One shared reference time and one configuration snapshot are used during a batch recomputation so businesses are calculated consistently. The batch service calculates visibility results first and then persists each business's updated score. 

---

# 19. Failure Handling

If visibility data is temporarily unavailable, the Celery task retries automatically.

The configured retry behavior is approximately:

```text
1st retry → 60 seconds
2nd retry → 120 seconds
3rd retry → 240 seconds
```

with a maximum delay of five minutes.

The scoring service also prevents an older calculation from overwriting a score produced by a newer calculation. If the requested calculation time is older than the currently stored score, that run is marked as stale and skipped. 

This protects the current score when tasks finish out of order.

---

# 20. How Hidden Gems Uses the Score

The **Hidden Gems** collection retrieves active businesses and orders them primarily by their stored Discovery Score.

The ordering is:

```text
1. Discovery Score — highest first
2. Business creation date — newest first
3. Business ID — lowest first
```

The service uses the stored Discovery Score as `discovery_rank_score`, defaulting to zero when no score exists. 

For the Hidden Gems collection specifically, specialty filtering does not replace the main Discovery Score ordering. 

---

# 21. Why SugboGo Uses This Approach

The algorithm supports SugboGo’s goal of helping users discover local businesses without simply rewarding whichever businesses are already the most popular.

The basic idea is:

```text
Specialty Score
→ "Do explorers genuinely support what this business is known for?"

Visibility Gap
→ "Has this business received less exposure than similar businesses?"

Discovery Score
→ "Is this a credible business that may deserve more discovery?"
```

The **80/20 weighting** keeps evidence quality as the dominant factor.

A business cannot rank highly only because it is underexposed. It still benefits greatly from genuine specialty evidence.

At the same time, a strong business that has not received much exposure gets a reasonable opportunity to appear higher in discovery.

---

## Summary

SugboGo's Discovery Score can be summarized as:

```text
Valid Specialty Vouches
        ↓
Reputation + Decay + Dampening
        ↓
Tag Scores
        ↓
Specialty Score (80%)
                      \
                       → Discovery Score → Hidden Gems
                      /
Recent Visibility
        ↓
Impressions + Visits + Saves
        ↓
Traction
        ↓
Visibility Gap (20%)
```

The result is a **bounded, explainable, configurable, and periodically refreshed score** designed to promote businesses based primarily on credible specialty evidence while still helping underexposed businesses gain discovery opportunities.

---

# 21. Limitations of the Discovery Score

The Discovery Score is intentionally designed as a **simple and explainable ranking model** for SugboGo’s Hidden Gems feature. It is not intended to match the complexity of large commercial recommendation systems.

Its main limitations are:

| Limitation | Explanation |
|---|---|
| Depends on available user activity | Businesses with very little explorer interaction may have limited evidence for Specialty Score and Visibility Gap. |
| Uses simple weighted scoring | The algorithm uses fixed configurable weights instead of machine learning or adaptive ranking models. |
| Specialty quality depends on vouches | Specialty Score assumes valid explorer vouches are meaningful indicators of what a business is known for. |
| Reputation is only one trust signal | Explorer reputation helps weight evidence, but it does not capture every possible factor related to vouch quality. |
| Time decay is simplified | Evidence becomes weaker using a fixed exponential decay rate rather than learning how quickly different types of businesses change over time. |
| Dampening is generic | The same dampening formula is applied to all specialties and businesses regardless of category or business size. |
| Visibility uses recent activity only | Visibility Gap only considers activity within the configured recent window, currently 30 days. |
| Visibility normalization is sensitive to the group maximum | Because each signal is divided by the highest value in the comparison group, one unusually high-performing business can affect the normalized scores of the others. |
| Comparison groups can still be broad | When a category does not have enough businesses, the system falls back to cluster or platform-level comparison, which may compare less similar businesses. |
| No advanced behavioral personalization | Discovery Score itself does not use collaborative filtering, embeddings, or machine-learning ranking models. |
| No prediction of business quality | A high Discovery Score does not mean a business is objectively better than another business. It only reflects the defined specialty and visibility signals. |
| New businesses may have limited evidence | Very new businesses may have a higher Visibility Gap but little specialty evidence, so the 80/20 weighting prevents underexposure alone from dominating the score. |
| Daily recalculation is not real-time | Score changes are reflected during scheduled recomputation rather than immediately after every interaction. |
| Scores depend on current configuration | Changing the weights, decay rate, visibility window, or comparison thresholds can affect rankings even when the underlying user activity remains the same. |

These limitations are intentional. SugboGo does not attempt to build a highly complex recommendation or ranking system. The goal is to provide a transparent and practical method for surfacing potentially underexposed local businesses in the Hidden Gems section using signals that are understandable and manageable within the scope of the capstone project.

---

# 22. Scope of the Algorithm

The Discovery Score is designed specifically for the **Hidden Gems** section.

It is not intended to:

- determine the objectively best business
- predict customer satisfaction
- replace the separate recommendation engine
- perform collaborative filtering
- use machine learning to automatically learn ranking weights
- guarantee equal exposure for every business

Instead, it provides a simple way to answer:

> **Which active businesses currently have credible specialty support while still having room for more visibility?**

This keeps the purpose of the algorithm focused and aligned with SugboGo’s goal of helping users discover underexposed local businesses.

---

# 23. Why SugboGo Uses This Approach

The algorithm supports SugboGo’s goal of helping users discover local businesses without simply rewarding whichever businesses are already the most popular.

The basic idea is:

```text
Specialty Score
→ "Do explorers genuinely support what this business is known for?"

Visibility Gap
→ "Has this business received less exposure than similar businesses?"

Discovery Score
→ "Is this a credible business that may deserve more discovery?"