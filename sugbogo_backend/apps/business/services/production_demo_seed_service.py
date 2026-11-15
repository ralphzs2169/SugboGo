"""Create an explicitly labeled, bounded demo dataset on a deployed database."""

import random
from decimal import Decimal

from django.conf import settings
from django.db import connection, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.admin_operations.system_configuration.models import (
    DiscoveryAlgorithmConfiguration,
)
from apps.admin_operations.system_configuration.services import (
    DiscoveryAlgorithmConfigurationService,
)
from apps.business.models import (
    Business,
    BusinessSpecialtyTag,
    BusinessVouch,
    Category,
    Cluster,
    Location,
    SpecialtyTag,
)
from apps.business.services.discovery_score_service import DiscoveryScoreService
from apps.business.services.production_demo_profile_service import (
    ProductionDemoProfileService,
)
from apps.business.services.serviceable_boundary_service import (
    ServiceableBoundaryService,
)
from apps.explorer_operations.explore_businesses.services.discovery_feed_service import (
    DiscoveryFeedService,
)
from apps.reviews.models import Review
from apps.reviews.services.gemini_sentiment_shadow_service import (
    GeminiSentimentShadowService,
)
from apps.users.models import User


MARKER = "SugboGo production demo v1."
DOMAIN = "production-demo.sugbogo.invalid"
MAX_EXPLORERS = 100
LISTINGS = (
    ("DEMO Capitol Coffee Corner", "Capitol / Escario", 10.3168, 123.8907),
    ("DEMO Fuente Pastry Nook", "Fuente Osmena", 10.3095, 123.8916),
    ("DEMO Colon Merienda House", "Colon / downtown", 10.2969, 123.8995),
    ("DEMO V Rama Brew Stop", "V. Rama Avenue", 10.3090, 123.8838),
    ("DEMO Guadalupe Garden Cafe", "Guadalupe", 10.3221, 123.8800),
)
SPECIALTIES = (
    ("DEMO Coffee", "coffee", "blue"),
    ("DEMO Pastries", "croissant", "yellow"),
    ("DEMO Merienda", "sandwich", "teal"),
)
REVIEW_DETAILS = (
    "The coffee and light snacks made a pleasant combination.",
    "The pastries were enjoyable and the service felt welcoming.",
    "A comfortable setting for a short afternoon break.",
    "The merienda selection offered a nice variety.",
    "The seating and relaxed atmosphere suited a quiet visit.",
    "The drinks paired well with the freshly prepared snacks.",
    "A convenient stop with friendly service and tasty food.",
    "The menu was easy to browse and portions were satisfying.",
    "The cafe had a cozy feel and a good snack selection.",
    "The simple refreshments were a highlight of the visit.",
)


class ProductionDemoSeedService:
    """Insert only new demo records, with read-only previews and atomic writes."""

    @staticmethod
    def _create(
        model,
        **fields,
    ):
        """Validate each new row before inserting it."""
        record = model(**fields)
        record.full_clean()
        record.save()
        return record

    @staticmethod
    def _taxonomy(
        model,
        name_field,
        name,
        **fields,
    ):
        """Reuse an exact reserved taxonomy row or reject conflicting data."""
        matches = list(model.objects.filter(**{name_field: name})[:2])
        if matches:
            if (
                len(matches) != 1
                or any(
                    getattr(matches[0], field) != value
                    for field, value in fields.items()
                )
            ):
                raise ValidationError("Reserved demo taxonomy conflicts with existing data.")
            return matches[0]
        return ProductionDemoSeedService._create(
            model,
            **{name_field: name},
            **fields,
        )

    @staticmethod
    def _account(
        identity,
        role,
        baseline,
    ):
        """Create a labeled demo account that cannot sign in with a password."""
        email = f"{identity}@{DOMAIN}"
        if User.objects.filter(USER_EMAIL__iexact=email).exists():
            raise ValidationError("Reserved demo account already exists; no accounts were changed.")
        user = User.objects.create_user(
            email=email,
            password=None,
            USER_FNAME="DEMO",
            USER_LNAME=identity,
            USER_ROLE=role,
            USER_STATUS=User.UserStatus.ACTIVE,
            USER_REPUTATION=baseline,
            EMAIL_VERIFIED=False,
            is_staff=False,
            is_superuser=False,
        )
        user.full_clean()
        return user

    @staticmethod
    def _explorer_count(configuration):
        """Bound the cohort while leaving specialty score headroom for decay."""
        baseline = configuration.DAC_REPUTATION_BASELINE
        threshold = configuration.DAC_HIDDEN_GEM_MIN_SPECIALTY_SCORE
        target = max(Decimal("0.90"), threshold + Decimal("0.02"))
        if baseline <= 0 or target >= 1:
            raise ValidationError(
                "The configured baseline/threshold cannot support this bounded demo seed.",
            )
        for count in range(10, MAX_EXPLORERS + 1):
            score = Decimal(1) - (-baseline * count).exp()
            if score >= target:
                return count
        raise ValidationError("The demo would require more than 100 explorers; no data was changed.")

    @staticmethod
    def _plan(configuration):
        """Check configuration, boundaries and reserved identities without any writes."""
        status = DiscoveryAlgorithmConfigurationService.get_reputation_configuration_status(
            configuration,
        )
        if not status["is_complete"]:
            raise ValidationError("Complete the existing reputation configuration first.")
        configuration.full_clean()
        count = ProductionDemoSeedService._explorer_count(configuration)
        rows = []
        for number, (name, area, latitude, longitude) in enumerate(
            LISTINGS,
            start=1,
        ):
            point = ServiceableBoundaryService.validate_serviceable(
                latitude,
                longitude,
            )
            email = f"owner-{number:02d}@{DOMAIN}"
            owner = User.objects.filter(USER_EMAIL__iexact=email).first()
            existing = None
            if owner is not None:
                existing = Business.objects.filter(USER_ID=owner).first()
                if (
                    existing is None
                    or existing.BUSN_NAME != name
                    or not (existing.BUSN_DESCRIPTION or "").startswith(MARKER)
                    or owner.USER_ROLE != User.UserRole.MERCHANT
                    or owner.is_staff
                    or owner.is_superuser
                    or owner.has_usable_password()
                ):
                    raise ValidationError("Reserved demo owner conflicts with existing data.")
            conflicts = Business.objects.filter(BUSN_NAME=name)
            if existing is not None:
                conflicts = conflicts.exclude(pk=existing.pk)
            if conflicts.exists():
                raise ValidationError("Reserved demo business name conflicts with existing data.")
            rows.append({
                "name": name,
                "area": area,
                "point": point,
                "existing": existing,
                "number": number,
                "reviews": 5 + number % 6,
            })
        existing_count = sum(row["existing"] is not None for row in rows)
        if existing_count not in (0, len(LISTINGS)):
            raise ValidationError(
                "Partial demo dataset found; refusing to repair or overwrite existing records.",
            )
        if not existing_count and User.objects.filter(
            USER_EMAIL__iendswith=f"@{DOMAIN}",
        ).exists():
            raise ValidationError("Reserved demo accounts already exist without the full dataset.")
        return {
            "rows": rows,
            "explorers": count,
            "created": 0,
            "reused": existing_count,
            "profiles_completed": 0,
            "sentiment_requested": 0,
            "vouches_per_business": count * len(SPECIALTIES),
        }

    @staticmethod
    def run(
        *,
        apply=False,
        confirm_database=None,
        enrich_existing=False,
        queue_sentiment=False,
    ):
        """Preview without writes or serialize one all-or-nothing PostgreSQL seed."""
        if connection.vendor != "postgresql":
            raise ValidationError("This command requires the configured PostgreSQL/PostGIS database.")
        if apply and confirm_database != str(connection.settings_dict["NAME"]):
            raise ValidationError("--apply requires --confirm-database matching DB_NAME exactly.")
        if queue_sentiment and not (
            settings.GEMINI_SENTIMENT_ALL_BUSINESSES
            and settings.GEMINI_SENTIMENT_CUTOVER_ENABLED
            and settings.GEMINI_API_KEY
        ):
            raise ValidationError(
                "--queue-sentiment requires global Gemini sentiment, cutover processing "
                "and a configured GEMINI_API_KEY. No settings were changed.",
            )
        if not apply:
            configuration = DiscoveryAlgorithmConfiguration.objects.filter(pk=1).first()
            if configuration is None:
                raise ValidationError("Existing discovery configuration is required; none was created.")
            return ProductionDemoSeedService._plan(configuration)
        with transaction.atomic():
            # Serialize command runs without locking shared configuration during MongoDB reads.
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT pg_try_advisory_xact_lock(hashtextextended(%s, 0))",
                    [MARKER],
                )
                if not cursor.fetchone()[0]:
                    raise ValidationError("Another demo seed is running; retry after it finishes.")
            configuration = DiscoveryAlgorithmConfiguration.objects.filter(pk=1).first()
            if configuration is None:
                raise ValidationError("Existing discovery configuration is required; none was created.")
            plan = ProductionDemoSeedService._plan(configuration)
            if plan["reused"]:
                if enrich_existing:
                    for row in plan["rows"]:
                        business = Business.objects.select_for_update().get(
                            pk=row["existing"].pk,
                        )
                        ProductionDemoProfileService.complete(
                            business,
                            row,
                            MARKER,
                            DOMAIN,
                        )
                        plan["profiles_completed"] += 1
            else:
                plan = ProductionDemoSeedService._insert(
                    plan,
                    configuration,
                )
            if queue_sentiment:
                ProductionDemoSeedService._request_sentiment(plan)
            return plan

    @staticmethod
    def _request_sentiment(plan):
        """Queue at most the original marked demo reviews using durable inference demand."""
        for row in plan["rows"]:
            business_id = row.get("business_id")
            if row["existing"] is not None:
                business_id = row["existing"].pk
            reviews = Review.objects.filter(
                BUSN_ID_id=business_id,
                REVW_STATUS=Review.ReviewStatus.PUBLISHED,
                REVW_MODERATION_DATA__demo_seed=MARKER,
                USER_ID__USER_EMAIL__iendswith=f"@{DOMAIN}",
                USER_ID__USER_ROLE=User.UserRole.EXPLORER,
                USER_ID__is_staff=False,
                USER_ID__is_superuser=False,
            ).order_by("pk")[:10]
            for review in reviews:
                if GeminiSentimentShadowService.request(review.pk) is not None:
                    plan["sentiment_requested"] += 1

    @staticmethod
    def _insert(
        plan,
        configuration,
    ):
        """Create the isolated fixture and verify real hidden-gem eligibility before commit."""
        create = ProductionDemoSeedService._create
        taxonomy = ProductionDemoSeedService._taxonomy
        cluster = taxonomy(
            Cluster,
            "CLUS_NAME",
            "DEMO Cebu Food Stops",
            CLUS_DESCRIPTION=MARKER,
            CLUS_ICON="utensils",
        )
        category = taxonomy(
            Category,
            "CTGRY_NAME",
            "DEMO Cafes and Merienda",
            CTGRY_DESCRIPTION=MARKER,
            CLUS_ID=cluster,
        )
        tags = [
            taxonomy(
                SpecialtyTag,
                "TAG_NAME",
                name,
                TAG_ICON=icon,
                TAG_COLOR=color,
            )
            for name, icon, color in SPECIALTIES
        ]
        explorers = [
            ProductionDemoSeedService._account(
                f"explorer-{number:03d}",
                User.UserRole.EXPLORER,
                configuration.DAC_REPUTATION_BASELINE,
            )
            for number in range(1, plan["explorers"] + 1)
        ]
        randomizer = random.Random(20261116)
        business_ids = []
        for row in plan["rows"]:
            owner = ProductionDemoSeedService._account(
                f"owner-{row['number']:02d}",
                User.UserRole.MERCHANT,
                configuration.DAC_REPUTATION_BASELINE,
            )
            location = create(
                Location,
                LOCT_POINT=row["point"],
                LOCT_ADDRESS=f"DEMO approximate map location: {row['area']}, Cebu City",
            )
            business = create(
                Business,
                BUSN_NAME=row["name"],
                BUSN_DESCRIPTION=(
                    f"{MARKER} Fictional cafe for demonstration only. "
                    "Not a real venue; reviews and vouches are synthetic."
                ),
                BUSN_CONTACT_NUMBER="DEMO - no phone",
                BUSN_STATUS=Business.BusinessStatus.ACTIVE,
                USER_ID=owner,
                CTGRY_ID=category,
                LOCT_ID=location,
            )
            ProductionDemoProfileService.complete(
                business,
                row,
                MARKER,
                DOMAIN,
            )
            plan["profiles_completed"] += 1
            for tag in tags:
                create(
                    BusinessSpecialtyTag,
                    BUSN_ID=business,
                    TAG_ID=tag,
                    BST_VOUCH_COUNT=len(explorers),
                )
                BusinessVouch.objects.bulk_create([
                    BusinessVouch(
                        BUSN_ID=business,
                        USER_ID=user,
                        TAG_ID=tag,
                        VOUCH_REPUTATION_SNAPSHOT=user.USER_REPUTATION,
                        VOUCH_RELIABILITY_EVIDENCE={"demo_seed": MARKER},
                    )
                    for user in explorers
                ])
            authors = randomizer.sample(explorers, row["reviews"])
            for index, author in enumerate(authors):
                create(
                    Review,
                    USER_ID=author,
                    BUSN_ID=business,
                    REVW_TEXT=(
                        f"[DEMO synthetic review {index + 1} for {row['name']}] "
                        f"{REVIEW_DETAILS[index]} This is sample content, not a real visit."
                    ),
                    REVW_STATUS=Review.ReviewStatus.PUBLISHED,
                    REVW_PUBLISHED_AT=timezone.now(),
                    REVW_SHOW_IN_COMMUNITY=False,
                    REVW_MODERATION_NOTES=MARKER,
                    REVW_MODERATION_DATA={"demo_seed": MARKER},
                )
            business.BUSN_REVIEW_COUNT = len(authors)
            business.BUSN_VOUCH_COUNT = plan["vouches_per_business"]
            business.save(update_fields=[
                "BUSN_REVIEW_COUNT",
                "BUSN_VOUCH_COUNT",
                "BUSN_UPDATED_AT",
            ])
            DiscoveryScoreService.recompute_business_score(
                business_id=business.pk,
                configuration=configuration,
                read_only_visibility=True,
            )
            business_ids.append(business.pk)
            row["business_id"] = business.pk
        eligible = Business.objects.filter(
            pk__in=business_ids,
        ).filter(DiscoveryFeedService.hidden_gem_eligibility()).count()
        if eligible != len(LISTINGS):
            raise ValidationError(
                "Demo businesses did not all meet current hidden-gem thresholds; all inserts rolled back.",
            )
        plan["created"] = len(business_ids)
        return plan
