from datetime import timedelta


from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.views import TokenRefreshView

from apps.authentication.services.email_service import EmailService
from apps.authentication.services.verification_service import EmailVerificationService
from apps.authentication.serializers import ResendVerificationSerializer

from .serializers import LoginSerializer, LogoutSerializer, RegisterSerializer

from apps.users.models import User

# "Remember me" unchecked -> short-lived refresh token (approved: 12 hours)
REMEMBER_ME_OFF_LIFETIME = timedelta(hours=12)


def _issue_tokens(user, remember_me: bool):
    """
    Issues an access + refresh token pair for a user.
    If remember_me is False, the refresh token's lifetime is shortened
    from the SIMPLE_JWT default (30 days) down to 12 hours.
    """
    refresh = RefreshToken.for_user(user)

    if not remember_me:
        refresh.set_exp(lifetime=REMEMBER_ME_OFF_LIFETIME)

    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }


@api_view(["POST"])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data["email"]
    password = serializer.validated_data["password"]
    remember_me = serializer.validated_data["remember_me"]

    try:
        user = User.objects.get(USER_EMAIL=email)
    except User.DoesNotExist:
        user = None

    if user is None or not user.check_password(password):
        return Response(
            {"detail": "Invalid email or password."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user.is_active:
        return Response(
            {"detail": f"Account is {user.USER_STATUS}. Please contact support."},
            status=status.HTTP_403_FORBIDDEN,
        )
    
    if not user.EMAIL_VERIFIED:
        return Response(
            {
                "detail": (
                    "Please verify your email address before logging in."
                )
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    tokens = _issue_tokens(user, remember_me)

    return Response(
        {
            "user": {
                "id": user.USER_ID,
                "email": user.USER_EMAIL,
                "role": user.USER_ROLE,
                "status": user.USER_STATUS,
                "has_completed_interest_selection": user.HAS_COMPLETED_INTEREST_SELECTION,
            },
            **tokens,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
def register_view(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    data = serializer.validated_data

    user = User.objects.create_user(
        email=data["email"],
        password=data["password"],
        USER_FNAME=data["first_name"],
        USER_LNAME=data["last_name"],
        USER_ROLE=User.UserRole.EXPLORER,   # hardcoded — never client-controlled
        USER_STATUS=User.UserStatus.ACTIVE,  # Explorers are active immediately
    )

    try:
        EmailService.send_verification_email(user)
    except Exception:
        pass

    return Response(
        {
            "message": "Registration successful. Please verify your email."
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
def logout_view(request):
    serializer = LogoutSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    refresh_token = serializer.validated_data["refresh"]

    try:
        token = RefreshToken(refresh_token)
        token.blacklist()
    except TokenError:
        return Response(
            {"detail": "Invalid or already-blacklisted token."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(
        {"detail": "Successfully logged out."},
        status=status.HTTP_205_RESET_CONTENT,
    )


# Token refresh — reuses simplejwt's built-in view directly, no custom
# logic needed since ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION
# in settings.py already handle blacklisting the old token automatically.
token_refresh_view = TokenRefreshView.as_view()


@api_view(["GET"])
def verify_email_view(request):
    uid = request.query_params.get("uid")
    token = request.query_params.get("token")

    if not uid or not token:
        return Response(
            {
                "detail": "Missing verification credentials."
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = EmailVerificationService.verify_token(uid, token)

    if user is None:
        return Response(
            {
                "detail": "Invalid or expired verification link."
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if user.EMAIL_VERIFIED:
        return Response(
            {
                "message": "Email is already verified.",
                "verified": True,
            },
            status=status.HTTP_200_OK,
        )

    user.EMAIL_VERIFIED = True
    user.EMAIL_VERIFIED_AT = timezone.now()
    user.save(
        update_fields=[
            "EMAIL_VERIFIED",
            "EMAIL_VERIFIED_AT",
        ]
    )

    return Response(
        {
            "message": "Email verified successfully.",
            "verified": True,
        },
        status=status.HTTP_200_OK,
    )

@api_view(["POST"])
def resend_verification_view(request):
    serializer = ResendVerificationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data["email"]

    try:
        user = User.objects.get(USER_EMAIL=email)

    except User.DoesNotExist:
        return Response(
            {
                "detail": "No account found with this email."
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    if user.EMAIL_VERIFIED:
        return Response(
            {
                "detail": "Email is already verified."
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        EmailService.send_verification_email(user)

    except Exception:
        return Response(
            {
                "detail": (
                    "Unable to send verification email. "
                    "Please try again later."
                )
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return Response(
        {
            "message": "Verification email sent successfully."
        },
        status=status.HTTP_200_OK,
    )