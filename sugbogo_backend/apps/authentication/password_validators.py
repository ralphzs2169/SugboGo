from django.core.exceptions import ValidationError


class NonBlankPasswordValidator:
    """Rejects whitespace-only passwords without changing meaningful password text."""

    def validate(self, password, user=None):
        """Preserves surrounding spaces while rejecting passwords the login forms cannot submit."""
        if not password.strip():
            raise ValidationError(
                "Your password cannot consist only of whitespace.",
                code="password_entirely_whitespace",
            )

    def get_help_text(self):
        """Describes the nonblank password requirement for framework consumers."""
        return "Your password cannot consist only of whitespace."
