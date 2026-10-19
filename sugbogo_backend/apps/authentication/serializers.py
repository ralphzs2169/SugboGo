from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.authentication.services.password_reset_service import (
    PasswordResetService,
)
from apps.users.models import User
from apps.users.serializers.profile_serializers import UserSerializer


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    remember_me = serializers.BooleanField(default=False)


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class ChangePasswordSerializer(serializers.Serializer):
    """Validates the authenticated password-change request shape."""

    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    confirm_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        """Requires an exact confirmation of the replacement password."""
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match."}
            )
        return attrs


class DeactivateAccountSerializer(serializers.Serializer):
    """Requires current-password proof and explicit account-deactivation consent."""

    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    confirm_deactivation = serializers.BooleanField()

    def validate_confirm_deactivation(self, value):
        """Rejects a request that does not explicitly confirm deactivation."""
        if not value:
            raise serializers.ValidationError("Confirm that you want to deactivate your account.")
        return value


class LoginResponseSerializer(serializers.Serializer):
    user = UserSerializer(read_only=True)
    access = serializers.CharField(read_only=True)
    refresh = serializers.CharField(read_only=True)


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(max_length=50)
    last_name = serializers.CharField(max_length=50)
    
    def validate_email(self, value):
        email = User.objects.normalize_email(value)
        if User.objects.filter(USER_EMAIL__iexact=email).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return email

    def validate_password(self, value):
        # Reuses Django's AUTH_PASSWORD_VALIDATORS from settings.py
        # (min length, common password check, numeric-only check, etc.)
        validate_password(value)
        return value

    
class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()
 

class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        """Validate matching passwords with the target user's context."""
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match."}
            )

        user = PasswordResetService.verify_token(
            attrs["uid"],
            attrs["token"],
        )

        try:
            validate_password(
                attrs["password"],
                user=user,
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                {"password": exc.messages}
            ) from exc

        return attrs
    

class ValidateResetTokenSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()


class AdminInvitationTokenSerializer(serializers.Serializer):
    """Validates the public Admin invitation token request shape."""

    uid = serializers.CharField()
    token = serializers.CharField()


class CompleteAdminInvitationSerializer(AdminInvitationTokenSerializer):
    """Validates the Admin invitation completion request shape."""

    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
    )
    confirm_password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
    )

    
class GoogleLoginSerializer(serializers.Serializer):
    id_token = serializers.CharField()


class FacebookLoginSerializer(serializers.Serializer):
    access_token = serializers.CharField()
