from decimal import Decimal

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


# Custom user manager to handle user creation and superuser creation.
class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address")

        if "USER_REPUTATION" not in extra_fields:
            from apps.admin_operations.system_configuration.services import (
                DiscoveryAlgorithmConfigurationService,
            )

            configuration = (
                DiscoveryAlgorithmConfigurationService
                .require_complete_reputation_configuration()
            )

            extra_fields["USER_REPUTATION"] = (
                configuration.DAC_REPUTATION_BASELINE
            )

        email = self.normalize_email(email)
        user = self.model(USER_EMAIL=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("USER_ROLE", User.UserRole.ADMIN)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)


# Custom user model, replacing Django's default User model. This is
# necessary because the default model uses a username field, but our ERD/data   
# dictionary specifies that users are identified by email instead.
class User(AbstractBaseUser, PermissionsMixin):
    class UserRole(models.TextChoices):
        EXPLORER = 'explorer', 'Explorer'
        MERCHANT = 'merchant', 'Merchant'
        ADMIN = 'admin', 'Admin'
        SUPER_ADMIN = 'super_admin', 'Super Admin'

    class UserStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACTIVE = 'active', 'Active'
        SUSPENDED = 'suspended', 'Suspended'
        DISABLED = 'disabled', 'Disabled'

    class Gender(models.TextChoices):
        MALE = 'male', 'Male'
        FEMALE = 'female', 'Female'
        NON_BINARY = "non_binary", "Non-binary"
        PREFER_NOT_TO_SAY = "prefer_not_to_say", "Prefer not to say"

    USER_ID = models.AutoField(primary_key=True)
    USER_ROLE = models.CharField(max_length=20, choices=UserRole.choices)
    USER_STATUS = models.CharField(max_length=20, choices=UserStatus.choices, default=UserStatus.PENDING)
    USER_EMAIL = models.EmailField(unique=True, max_length=100)

    USER_PROFILE_PICTURE = models.URLField(
        max_length=500,
        blank=True,
        null=True,
    )
    # This field stores the public ID of the user's profile picture in the cloud storage service (e.g., Cloudinary). 
    # It is used for managing the image, such as deleting or updating it.
    USER_PROFILE_PICTURE_PUBLIC_ID = models.CharField(
        max_length=255,
        null=True,
        blank=True
    )
    USER_USE_OAUTH_AVATAR = models.BooleanField(
        default=True,
    )
    
    EMAIL_VERIFIED = models.BooleanField(default=False)
    EMAIL_VERIFIED_AT = models.DateTimeField(null=True, blank=True)

    # CHANGE 1: explicitly override the inherited `password` field so the
    # actual database column is named USER_PASSWORD, matching the ERD/data
    # dictionary. The Python attribute stays `password` because Django's
    # auth internals (set_password, check_password, authenticate) require
    # that exact name — only the db_column changes.
    password = models.CharField(max_length=128, db_column='USER_PASSWORD')

    USER_FNAME = models.CharField(max_length=50)
    USER_LNAME = models.CharField(max_length=50)
    USER_MI = models.CharField(max_length=1, blank=True, null=True)
    USER_GENDER = models.CharField(max_length=20, choices=Gender.choices, blank=True, null=True)
    USER_IS_VERIFIED = models.BooleanField(default=False)
    HAS_COMPLETED_INTEREST_SELECTION = models.BooleanField(default=False)
    USER_REPUTATION = models.DecimalField(
        max_digits=6,
        decimal_places=5,
        default=Decimal("0.20"),
        validators=[
            MinValueValidator(
                Decimal("0.00"),
            ),
            MaxValueValidator(
                Decimal("1.00"),
            ),
        ],
    )

    
    last_login = models.DateTimeField(
        db_column="USER_LAST_LOGIN_AT",
        blank=True,
        null=True,
    )

    USER_CREATED_AT = models.DateTimeField(auto_now_add=True)
    USER_UPDATED_AT = models.DateTimeField(auto_now=True)

    is_staff = models.BooleanField(default=False)  # required for Django admin site access

    objects = UserManager()

    USERNAME_FIELD = "USER_EMAIL"
    REQUIRED_FIELDS = ("USER_FNAME", "USER_LNAME")

    class Meta:
        constraints = [  # noqa: RUF012
            models.CheckConstraint(
                condition=(
                    models.Q(
                        USER_REPUTATION__gte=Decimal("0.00"),
                    )
                    & models.Q(
                        USER_REPUTATION__lte=Decimal("1.00"),
                    )
                ),
                name="user_reputation_between_zero_and_one",
            ),
        ]

    @property
    def full_name(self):
        return f"{self.USER_FNAME} {self.USER_LNAME}".strip()
    
    # CHANGE 2: computed property, not a real column. Satisfies Django/DRF
    # code that checks `user.is_active`, while USER_STATUS remains the
    # single real source of truth (avoids two fields disagreeing, e.g.
    # USER_STATUS='suspended' but a stale is_active=True).
    @property
    def is_active(self):
        return self.USER_STATUS == self.UserStatus.ACTIVE

    @property
    def avatar_url(self):
        """
        Returns the avatar that should be displayed.

        Priority:
        1. Custom uploaded profile picture.
        2. Latest connected OAuth avatar (if enabled).
        3. None.
        """

        if self.USER_PROFILE_PICTURE:
            return self.USER_PROFILE_PICTURE

        if self.USER_USE_OAUTH_AVATAR:
            oauth = (
                self.OAUTH_ACCOUNTS
                .filter(OAUTH_AVATAR_URL__isnull=False)
                .exclude(OAUTH_AVATAR_URL="")
                .order_by("-OAUTH_CREATED_AT")
                .first()
            )

            if oauth:
                return oauth.OAUTH_AVATAR_URL

        return None

    @property
    def oauth_avatar_url(self):
        oauth = (
            self.OAUTH_ACCOUNTS
            .filter(OAUTH_AVATAR_URL__isnull=False)
            .exclude(OAUTH_AVATAR_URL="")
            .order_by("-OAUTH_CREATED_AT")
            .first()
        )

        return oauth.OAUTH_AVATAR_URL if oauth else None

    @property
    def has_custom_profile_picture(self):
        return bool(self.USER_PROFILE_PICTURE)

    @property
    def has_oauth_accounts(self):
        return self.OAUTH_ACCOUNTS.exists()

    def __str__(self):
        return self.USER_EMAIL


class ReputationEvent(models.Model):
    """An immutable-by-convention audit entry for a reputation change."""

    class EventType(models.TextChoices):
        VOUCH_REWARD = "vouch_reward", "Vouch reward"
        REVIEW_REWARD = "review_reward", "Review reward"
        REVIEW_WITH_PHOTO_REWARD = (
            "review_with_photo_reward",
            "Review with photo reward",
        )
        APPROVED_REPORT_REWARD = (
            "approved_report_reward",
            "Approved report reward",
        )
        CONFIRMED_VIOLATION_PENALTY = (
            "confirmed_violation_penalty",
            "Confirmed violation penalty",
        )

    class SourceType(models.TextChoices):
        BUSINESS_VOUCH = "business_vouch", "Business vouch"
        BUSINESS_REVIEW = "business_review", "Business review"
        REVIEW_REPORT = "review_report", "Review report"
        CONFIRMED_REVIEW_VIOLATION = (
            "confirmed_review_violation",
            "Confirmed review violation",
        )

    REVT_ID = models.AutoField(
        primary_key=True,
    )

    USER_ID = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        db_column="USER_ID",
        related_name="reputation_events",
    )

    REVT_EVENT_TYPE = models.CharField(
        max_length=40,
        choices=EventType.choices,
    )

    REVT_APPLIED_CHANGE = models.DecimalField(
        max_digits=6,
        decimal_places=5,
        validators=[
            MinValueValidator(
                Decimal("-1.00"),
            ),
            MaxValueValidator(
                Decimal("1.00"),
            ),
        ],
    )

    REVT_RESULTING_REPUTATION = models.DecimalField(
        max_digits=6,
        decimal_places=5,
        validators=[
            MinValueValidator(
                Decimal("0.00"),
            ),
            MaxValueValidator(
                Decimal("1.00"),
            ),
        ],
    )

    REVT_SOURCE_TYPE = models.CharField(
        max_length=40,
        choices=SourceType.choices,
    )

    REVT_SOURCE_ID = models.PositiveBigIntegerField(
        validators=[
            MinValueValidator(1),
        ],
    )

    REVT_CREATED_AT = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        db_table = "REPUTATION_EVENT"
        ordering = ["-REVT_CREATED_AT"]
        constraints = [  # noqa: RUF012
            models.UniqueConstraint(
                fields=[
                    "REVT_SOURCE_TYPE",
                    "REVT_SOURCE_ID",
                ],
                name="unique_reputation_event_source",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        REVT_APPLIED_CHANGE__gte=Decimal("-1.00"),
                    )
                    & models.Q(
                        REVT_APPLIED_CHANGE__lte=Decimal("1.00"),
                    )
                ),
                name="reputation_event_change_in_range",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        REVT_RESULTING_REPUTATION__gte=Decimal("0.00"),
                    )
                    & models.Q(
                        REVT_RESULTING_REPUTATION__lte=Decimal("1.00"),
                    )
                ),
                name="reputation_event_result_in_range",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    REVT_SOURCE_ID__gte=1,
                ),
                name="reputation_event_source_id_positive",
            ),
        ]

    def __str__(self):
        return f"Reputation event {self.REVT_ID}"
