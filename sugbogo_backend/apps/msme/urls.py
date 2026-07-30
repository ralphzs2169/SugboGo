from django.urls import path

from .views import MsmeListView, MsmeDetailView, MsmeVerifyView

urlpatterns = [
    path('', MsmeListView.as_view(), name='msme-list'),
    path('<int:MSME_ID>/', MsmeDetailView.as_view(), name='msme-detail'),
    path('<int:MSME_ID>/verify/', MsmeVerifyView.as_view(), name='msme-verify'),
]