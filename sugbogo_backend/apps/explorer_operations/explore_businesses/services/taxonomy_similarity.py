from decimal import Decimal
from math import sqrt

FeatureKey = tuple[str, int]
FeatureMap = dict[FeatureKey, Decimal]


def build_business_feature_map(
    business,
    configuration,
) -> FeatureMap:
    """Build the configured taxonomy vector shared by discovery features."""

    features = {
        ("cluster", business.CTGRY_ID.CLUS_ID_id): (
            configuration.RAC_CLUSTER_WEIGHT
        ),
        ("category", business.CTGRY_ID_id): (
            configuration.RAC_CATEGORY_WEIGHT
        ),
    }

    for link in business.active_specialty_tag_links:
        features[("tag", link.TAG_ID_id)] = (
            configuration.RAC_SPECIALTY_TAG_WEIGHT
        )

    return features


def cosine_similarity(
    first: FeatureMap,
    second: FeatureMap,
) -> float:
    """Calculate cosine similarity without requiring a fixed vocabulary."""

    if not first or not second:
        return 0.0

    shared_keys = first.keys() & second.keys()
    dot_product = sum(
        float(first[key]) * float(second[key])
        for key in shared_keys
    )
    first_norm = sqrt(
        sum(
            float(value) ** 2
            for value in first.values()
        ),
    )
    second_norm = sqrt(
        sum(
            float(value) ** 2
            for value in second.values()
        ),
    )

    if first_norm == 0 or second_norm == 0:
        return 0.0

    similarity = dot_product / (first_norm * second_norm)

    return min(
        1.0,
        max(
            0.0,
            similarity,
        ),
    )
