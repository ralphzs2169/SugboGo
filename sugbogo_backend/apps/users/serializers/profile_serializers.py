from rest_framework import serializers

from apps.users.models import User


class UserSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="USER_ID", read_only=True)
    email = serializers.EmailField(source="USER_EMAIL", read_only=True)
    first_name = serializers.CharField(source="USER_FNAME", read_only=True)
    last_name = serializers.CharField(source="USER_LNAME", read_only=True)
    gender = serializers.CharField(source="USER_GENDER", read_only=True)

    avatar_url = serializers.ReadOnlyField()
    avatar_key = serializers.ChoiceField(
        source="USER_AVATAR_KEY",
        choices=User.AvatarKey.choices,
        read_only=True,
        allow_null=True,
    )
    role = serializers.CharField(source="USER_ROLE", read_only=True)
    status = serializers.CharField(source="USER_STATUS", read_only=True)
    has_custom_profile_picture = serializers.BooleanField(read_only=True)
    has_completed_interest_selection = serializers.BooleanField(
        source="HAS_COMPLETED_INTEREST_SELECTION",
        read_only=True,
    )
    has_oauth_accounts = serializers.BooleanField(read_only=True,)
    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "gender",

            "avatar_url",
            "avatar_key",
            "has_custom_profile_picture",

            "role",
            "status",
            "has_completed_interest_selection",
            "has_oauth_accounts",
        )


class ProfilePictureSerializer(serializers.Serializer):
    """
    Validates a profile picture upload request.
    """

    image = serializers.ImageField()


class UserUpdateSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(source="USER_FNAME")
    last_name = serializers.CharField(source="USER_LNAME")
    gender = serializers.ChoiceField(
        source="USER_GENDER",
        choices=User.Gender.choices,
        required=False,
        allow_null=True,
    )
    avatar_key = serializers.ChoiceField(
        source="USER_AVATAR_KEY",
        choices=User.AvatarKey.choices,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = User
        fields = (
            "first_name",
            "last_name",
            "gender",
            "avatar_key",
        )


class UserInterestsUpdateSerializer(serializers.Serializer):
    category_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
    )
    specialty_tag_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
    )

    def validate(self, attrs):
        for field_name in (
            "category_ids",
            "specialty_tag_ids",
        ):
            if field_name in attrs:
                attrs[field_name] = list(
                    dict.fromkeys(
                        attrs[field_name],
                    ),
                )

        if self.context.get("onboarding"):
            specialty_tag_ids = attrs.get(
                "specialty_tag_ids",
                [],
            )

            if len(specialty_tag_ids) > 3:
                raise serializers.ValidationError(
                    {
                        "specialty_tag_ids": (
                            "Select no more than 3 specialty tags during "
                            "onboarding."
                        ),
                    },
                )

        return attrs
