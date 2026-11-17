from django.contrib import admin

from .models import User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    """Route manual verification through the audited Admin Panel action."""

    readonly_fields = (
        "EMAIL_VERIFIED",
        "EMAIL_VERIFIED_AT",
    )

