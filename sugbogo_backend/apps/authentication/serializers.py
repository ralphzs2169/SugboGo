from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.users.models import User
from apps.users.serializers.profile import UserSerializer

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    remember_me = serializers.BooleanField(default=False)

class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()

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

    def validate_password(self, value):
        # Reuse Django's AUTH_PASSWORD_VALIDATORS
        validate_password(value)
        return value
    

class ValidateResetTokenSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()

    
class GoogleLoginSerializer(serializers.Serializer):
    id_token = serializers.CharField()

class FacebookLoginSerializer(serializers.Serializer):
    access_token = serializers.CharField()