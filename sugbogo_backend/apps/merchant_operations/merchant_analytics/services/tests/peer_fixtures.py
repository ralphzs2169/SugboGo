from datetime import timedelta

from apps.business.models import Business, BusinessSpecialtyTag, BusinessVouch, Category, Cluster
from apps.reviews.models import Review
from apps.users.models import User

from .fixtures import MerchantAnalyticsFixtures


class PeerAnalyticsFixtures(MerchantAnalyticsFixtures):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        Business.objects.filter(pk__in=(cls.business_a.pk, cls.business_b.pk)).update(
            BUSN_CREATED_AT=cls.NOW - timedelta(days=100),
        )

    def peer(self, *, category=None, status=Business.BusinessStatus.ACTIVE):
        number = Business.objects.count()
        owner = self.user(f"peer-owner-{number}", User.UserRole.MERCHANT)
        business = Business.objects.create(
            BUSN_NAME=f"Private peer {number}", BUSN_CONTACT_NUMBER="09170000000", USER_ID=owner,
            CTGRY_ID=category or self.business_a.CTGRY_ID, LOCT_ID=self.business_a.LOCT_ID, BUSN_STATUS=status,
        )
        Business.objects.filter(pk=business.pk).update(BUSN_CREATED_AT=self.NOW - timedelta(days=100))
        return business

    def five_peers(self):
        return [self.business_b, *[self.peer() for _ in range(4)]]

    def other_category(self, *, other_cluster=False):
        cluster = Cluster.objects.create(CLUS_NAME=f"Other cluster {Cluster.objects.count()}") if other_cluster else self.business_a.CTGRY_ID.CLUS_ID
        return Category.objects.create(CTGRY_NAME=f"Other category {Category.objects.count()}", CLUS_ID=cluster)

    def sentiment(self, business, positive, classified, *, created_at=None):
        for index in range(classified):
            review = self.review(created_at or self.NOW - timedelta(days=1), business=business)
            Review.objects.filter(pk=review.pk).update(REVW_SENTIMENT_LABEL="positive" if index < positive else "negative")

    def support(self, business, tag, *, valid=True, active=True, timestamp=None, user=None):
        link, _ = BusinessSpecialtyTag.objects.get_or_create(BUSN_ID=business, TAG_ID=tag)
        BusinessSpecialtyTag.objects.filter(pk=link.pk).update(
            BST_CREATED_AT=self.NOW - timedelta(days=60), BST_IS_ACTIVE=active,
        )
        supporter = user or self.supporter_a
        vouch = BusinessVouch.objects.create(
            BUSN_ID=business, TAG_ID=tag, USER_ID=supporter,
            VOUCH_REPUTATION_SNAPSHOT=supporter.USER_REPUTATION, VOUCH_EVIDENCE_IS_VALID=valid,
        )
        BusinessVouch.objects.filter(pk=vouch.pk).update(VOUCH_CREATED_AT=timestamp or self.NOW - timedelta(days=1))
        return vouch
