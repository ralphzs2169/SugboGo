from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class User(models.Model):
    class UserRole(models.TextChoices):
        EXPLORER = 'explorer', 'Explorer'
        MERCHANT = 'merchant', 'Merchant'
        ADMIN = 'admin', 'Admin'

    class Gender(models.TextChoices):
        MALE = 'male', 'Male'
        FEMALE = 'female', 'Female'
        OTHER = 'other', 'Other'

    USER_ID = models.AutoField(primary_key=True)
    USER_ROLE = models.CharField(max_length=20, choices=UserRole.choices)
    USER_EMAIL = models.EmailField(unique=True, max_length=100)
    USER_PASSWORD = models.CharField(max_length=255)
    USER_FNAME = models.CharField(max_length=50)
    USER_LNAME = models.CharField(max_length=50)
    USER_MI = models.CharField(max_length=1, blank=True, null=True)
    USER_GENDER = models.CharField(max_length=10, choices=Gender.choices, blank=True, null=True)
    USER_IS_VERIFIED = models.BooleanField(default=False)
    USER_IS_ACTIVE = models.BooleanField(default=True)
    USER_REPUTATION = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[MinValueValidator(0.01), MaxValueValidator(1.00)],
    )
    USER_LAST_LOGIN_AT = models.DateTimeField(blank=True, null=True)
    USER_CREATED_AT = models.DateTimeField(auto_now_add=True)
    USER_UPDATED_AT = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.USER_EMAIL
