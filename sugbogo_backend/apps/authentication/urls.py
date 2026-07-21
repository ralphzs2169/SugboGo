from django.urls import path
from . import views

urlpatterns = [
    path('login/', views.login_view, name='login'),
    path('admin/login/', views.admin_login_view, name='admin_login'),

    path('register/', views.register_view, name='register'),
    path('logout/', views.logout_view, name='logout'),
    path('refresh/', views.token_refresh_view, name='token_refresh'),

    path("verify-email/", views.verify_email_view, name="verify_email"),
    path("resend-verification/", views.resend_verification_view, name="resend_verification"),

    path("forgot-password/", views.forgot_password_view, name="forgot_password"),
    path('admin/forgot-password/', views.admin_forgot_password_view, name='admin_forgot_password'),
    
    path("reset-password/validate/", views.validate_reset_token_view, name="validate_reset_token"),
    path("reset-password/", views.reset_password_view, name="reset_password"),
    path("password-reset-config/",views.password_reset_config_view,name="password_reset_config"),

    path("google-login/", views.google_login_view, name="google_login"),
    path("facebook-login/",views.facebook_login_view,name="facebook_login"),
]