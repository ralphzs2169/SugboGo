from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("merchant_analytics", "0006_remove_demo_merchant_plus_entitlement"),
    ]

    operations = [
        migrations.DeleteModel(name="MerchantRecommendation"),
    ]
