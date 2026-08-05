from django.contrib import admin

from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationDocument,
    MerchantApplicationIdentity,
    MerchantApplicationLandmark,
    MerchantApplicationLocation,
    MerchantApplicationOperatingHours,
    MerchantApplicationPhotos,
)


@admin.register(MerchantApplication)
class MerchantApplicationAdmin(admin.ModelAdmin):
    list_display = ("MAPP_ID", "USER_ID", "MAPP_STATUS", "MAPP_CURRENT_STEP", "MAPP_CREATED_AT")
    list_filter = ("MAPP_STATUS",)
    search_fields = ("USER_ID__email",)


@admin.register(MerchantApplicationIdentity)
class MerchantApplicationIdentityAdmin(admin.ModelAdmin):
    list_display = ("MIDN_ID", "MIDN_BUSINESS_NAME", "MAPP_ID", "CLUS_ID", "CTGRY_ID")
    search_fields = ("MIDN_BUSINESS_NAME",)


@admin.register(MerchantApplicationLocation)
class MerchantApplicationLocationAdmin(admin.ModelAdmin):
    list_display = ("MLOC_ID", "MLOC_CITY", "MLOC_BARANGAY", "MAPP_ID")


@admin.register(MerchantApplicationLandmark)
class MerchantApplicationLandmarkAdmin(admin.ModelAdmin):
    list_display = ("MLMK_ID", "MLMK_NAME", "MLOC_ID", "MLMK_SOURCE")


@admin.register(MerchantApplicationOperatingHours)
class MerchantApplicationOperatingHoursAdmin(admin.ModelAdmin):
    list_display = ("MHRS_ID", "MAPP_ID", "MHRS_DAY", "MHRS_IS_OPEN", "MHRS_IS_24_HOURS")
    list_filter = ("MHRS_DAY", "MHRS_IS_OPEN")


@admin.register(MerchantApplicationPhotos)
class MerchantApplicationPhotosAdmin(admin.ModelAdmin):
    list_display = ("MPHT_ID", "MAPP_ID", "MPHT_CATEGORY", "MPHT_FILE_NAME")
    list_filter = ("MPHT_CATEGORY",)


@admin.register(MerchantApplicationDocument)
class MerchantApplicationDocumentAdmin(admin.ModelAdmin):
    list_display = ("MDOC_ID", "MAPP_ID", "MDOC_DOCUMENT_TYPE", "MDOC_FILE_NAME")
    list_filter = ("MDOC_DOCUMENT_TYPE",)