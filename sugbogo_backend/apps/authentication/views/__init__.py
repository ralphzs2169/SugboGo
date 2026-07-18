from .login import login_view as login_view
from .register import register_view as register_view
from .logout import logout_view as logout_view
from .token import token_refresh_view as token_refresh_view

from .email_verification import (
    verify_email_view as verify_email_view,
    resend_verification_view as resend_verification_view,
)

from .password_reset import (
    reset_password_view as reset_password_view,
)

from .forgot_password import (
    forgot_password_view as forgot_password_view,
)

# from .oauth import google_login_view as google_login_view