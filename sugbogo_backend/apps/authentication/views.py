# from datetime import timedelta


# from django.utils import timezone
# from rest_framework import status
# from rest_framework.decorators import api_view, throttle_classes
# from rest_framework_simplejwt.tokens import RefreshToken
# from rest_framework_simplejwt.exceptions import TokenError
# from rest_framework_simplejwt.views import TokenRefreshView

# from apps.authentication.services.email_service import EmailService
# from apps.authentication.services.verification_service import EmailVerificationService
# from apps.authentication.services.password_reset_service import PasswordResetService
# from rest_framework.exceptions import Throttled


# from apps.core.responses import error_response, success_response

# from apps.authentication.throttles import (
#     ResendVerificationThrottle,
#     ForgotPasswordThrottle,
# )

# from .serializers import (
#     LoginSerializer, 
#     LogoutSerializer, 
#     RegisterSerializer, 
#     ResendVerificationSerializer,
#     ForgotPasswordSerializer,
#     ResetPasswordSerializer
# )

# from apps.users.models import User

# # "Remember me" unchecked -> short-lived refresh token (approved: 12 hours)
# REMEMBER_ME_OFF_LIFETIME = timedelta(hours=12)


# def _issue_tokens(user, remember_me: bool):
#     """
#     Issues an access + refresh token pair for a user.
#     If remember_me is False, the refresh token's lifetime is shortened
#     from the SIMPLE_JWT default (30 days) down to 12 hours.
#     """
#     refresh = RefreshToken.for_user(user)

#     if not remember_me:
#         refresh.set_exp(lifetime=REMEMBER_ME_OFF_LIFETIME)

#     return {
#         "refresh": str(refresh),
#         "access": str(refresh.access_token),
#     }


# @api_view(["POST"])
# def login_view(request):
#     serializer = LoginSerializer(data=request.data)
#     serializer.is_valid(raise_exception=True)

#     email = serializer.validated_data["email"]
#     password = serializer.validated_data["password"]
#     remember_me = serializer.validated_data["remember_me"]

#     try:
#         user = User.objects.get(USER_EMAIL=email)
#     except User.DoesNotExist:
#         user = None

#     if user is None or not user.check_password(password):
#         return error_response(
#             message="Invalid email or password.",
#             code="INVALID_CREDENTIALS",
#             status_code=status.HTTP_401_UNAUTHORIZED,
#         )

#     if not user.is_active:
#         return error_response(
#             message=f"Account is {user.USER_STATUS}. Please contact support.",
#             code="ACCOUNT_INACTIVE",
#             status_code=status.HTTP_403_FORBIDDEN,
#         )
    
#     if not user.EMAIL_VERIFIED:
#         return error_response(
#             message="Please verify your email address before logging in.",
#             code="EMAIL_NOT_VERIFIED",
#             status_code=status.HTTP_403_FORBIDDEN,
#         )

#     tokens = _issue_tokens(user, remember_me)

#     return success_response(
#         message="Login successful.",
#         data={
#             "user": {
#                 "id": user.USER_ID,
#                 "email": user.USER_EMAIL,
#                 "role": user.USER_ROLE,
#                 "status": user.USER_STATUS,
#                 "has_completed_interest_selection": user.HAS_COMPLETED_INTEREST_SELECTION,
#             },
#             **tokens,
#         }
#     )


# @api_view(["POST"])
# def register_view(request):
#     serializer = RegisterSerializer(data=request.data)
#     serializer.is_valid(raise_exception=True)

#     data = serializer.validated_data

#     user = User.objects.create_user(
#         email=data["email"],
#         password=data["password"],
#         USER_FNAME=data["first_name"],
#         USER_LNAME=data["last_name"],
#         USER_ROLE=User.UserRole.EXPLORER,   
#         USER_STATUS=User.UserStatus.ACTIVE, 
#     )

#     try:
#         EmailService.send_verification_email(user)
#     except Exception:
#         pass

#     return success_response(
#         message="Registration successful. Please verify your email.",
#         status_code=status.HTTP_201_CREATED,
#     )


# @api_view(["POST"])
# def logout_view(request):
#     serializer = LogoutSerializer(data=request.data)
#     serializer.is_valid(raise_exception=True)

#     refresh_token = serializer.validated_data["refresh"]

#     try:
#         token = RefreshToken(refresh_token)
#         token.blacklist()
#     except TokenError:
#         return error_response(
#             message="Invalid refresh token.",
#             code="INVALID_TOKEN",
#             status_code=status.HTTP_400_BAD_REQUEST,
#         )

#     return success_response(
#         message="Successfully logged out.",
#         status_code=status.HTTP_205_RESET_CONTENT,
#     )


# # Token refresh — reuses simplejwt's built-in view directly, no custom
# # logic needed since ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION
# # in settings.py already handle blacklisting the old token automatically.
# token_refresh_view = TokenRefreshView.as_view()


# @api_view(["GET"])
# def verify_email_view(request):
#     uid = request.query_params.get("uid")
#     token = request.query_params.get("token")

#     if not uid or not token:
#         return error_response(
#             message="Missing verification credentials.",
#             code="MISSING_CREDENTIALS",
#             status_code=status.HTTP_400_BAD_REQUEST,
#         )

#     user = EmailVerificationService.verify_token(uid, token)

#     if user is None:
#        return error_response(
#             message=(
#                 "This verification link is invalid or has expired. "
#                 "Please request a new verification email."
#             ),
#             code="INVALID_VERIFICATION_LINK",
#             status_code=status.HTTP_400_BAD_REQUEST,
#         )

#     if user.EMAIL_VERIFIED:
#         return success_response(message="Email is already verified.")

#     user.EMAIL_VERIFIED = True
#     user.EMAIL_VERIFIED_AT = timezone.now()
#     user.save(
#         update_fields=[
#             "EMAIL_VERIFIED",
#             "EMAIL_VERIFIED_AT",
#         ]
#     )

#     return success_response(message="Email verified successfully.")

# @api_view(["POST"])
# def resend_verification_view(request):
#     serializer = ResendVerificationSerializer(data=request.data)
#     serializer.is_valid(raise_exception=True)

#     email = serializer.validated_data["email"]

#     try:
#         user = User.objects.get(USER_EMAIL=email)

#     except User.DoesNotExist:
#         return error_response(
#             message="No account found with this email.",
#             code="USER_NOT_FOUND",
#             status_code=status.HTTP_404_NOT_FOUND,
#         )

#     if user.EMAIL_VERIFIED:
#          return error_response(
#             message="Email is already verified.",
#             code="EMAIL_ALREADY_VERIFIED",
#             status_code=status.HTTP_409_CONFLICT,
#         )

#     throttle = ResendVerificationThrottle()

#     if not throttle.allow_request(request, view=None):
#         raise Throttled(wait=throttle.wait())
    

#     try:
#         EmailService.send_verification_email(user)
    
#     except Exception:
#         return error_response(
#             message=(
#                 "Unable to send verification email. "
#                 "Please try again later."
#             ),
#             code="EMAIL_SEND_FAILED",
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#         )

#     return success_response(message="Verification email sent successfully.")


# @api_view(["POST"])
# @throttle_classes([ForgotPasswordThrottle])
# def forgot_password_view(request):
#     """Handle forgot password requests."""
#     serializer = ForgotPasswordSerializer(data=request.data)
#     serializer.is_valid(raise_exception=True)

#     email = serializer.validated_data["email"]

#     try:
#         user = User.objects.get(USER_EMAIL__iexact=email)

#     except User.DoesNotExist:
#         user = None


#     if user is not None:
#         try:
#             EmailService.send_password_reset_email(user)
#         except Exception:
#             pass

#     # Always return the same response to avoid revealing
#     # whether an email address is registered.
#     return success_response(
#         message=(
#             "If an account exists with this email, "
#             "a password reset link has been sent."
#         )
#     )

# @api_view(["POST"])
# def reset_password_view(request):
#     """Reset a user's password using a valid reset token."""
#     serializer = ResetPasswordSerializer(data=request.data)
#     serializer.is_valid(raise_exception=True)

#     user = PasswordResetService.reset_password(
#         uid=serializer.validated_data["uid"],
#         token=serializer.validated_data["token"],
#         password=serializer.validated_data["password"],
#     )

#     if user is None:
#         return error_response(
#             message="This password reset link is invalid or has expired.",
#             code="INVALID_RESET_LINK",
#             status_code=status.HTTP_400_BAD_REQUEST,
#         )

#     return success_response(message="Password reset successfully.")   
