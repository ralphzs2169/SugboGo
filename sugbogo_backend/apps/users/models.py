from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


# Custom user manager to handle user creation and superuser creation.
class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address")
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

    class UserStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACTIVE = 'active', 'Active'
        SUSPENDED = 'suspended', 'Suspended'
        DISABLED = 'disabled', 'Disabled'

    class Gender(models.TextChoices):
        MALE = 'male', 'Male'
        FEMALE = 'female', 'Female'
        OTHER = 'other', 'Other'

    USER_ID = models.AutoField(primary_key=True)
    USER_ROLE = models.CharField(max_length=20, choices=UserRole.choices)
    USER_STATUS = models.CharField(max_length=20, choices=UserStatus.choices, default=UserStatus.PENDING)
    USER_EMAIL = models.EmailField(unique=True, max_length=100)

    # CHANGE 1: explicitly override the inherited `password` field so the
    # actual database column is named USER_PASSWORD, matching the ERD/data
    # dictionary. The Python attribute stays `password` because Django's
    # auth internals (set_password, check_password, authenticate) require
    # that exact name — only the db_column changes.
    password = models.CharField(max_length=128, db_column='USER_PASSWORD')

    USER_FNAME = models.CharField(max_length=50)
    USER_LNAME = models.CharField(max_length=50)
    USER_MI = models.CharField(max_length=1, blank=True, null=True)
    USER_GENDER = models.CharField(max_length=10, choices=Gender.choices, blank=True, null=True)
    USER_IS_VERIFIED = models.BooleanField(default=False)
    USER_REPUTATION = models.DecimalField(
        max_digits=3, decimal_places=2, blank=True, null=True,
        validators=[MinValueValidator(0.01), MaxValueValidator(1.00)],
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
    REQUIRED_FIELDS = ["USER_FNAME", "USER_LNAME"]

    # CHANGE 2: computed property, not a real column. Satisfies Django/DRF
    # code that checks `user.is_active`, while USER_STATUS remains the
    # single real source of truth (avoids two fields disagreeing, e.g.
    # USER_STATUS='suspended' but a stale is_active=True).
    @property
    def is_active(self):
        return self.USER_STATUS == self.UserStatus.ACTIVE

    def __str__(self):
        return self.USER_EMAIL