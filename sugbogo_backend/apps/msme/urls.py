from django.urls import path

from .views import MsmeDetailView, MsmeListView

urlpatterns = [
    
    path('', MsmeListView.as_view(), name='msme-list'),
    path('<int:MSME_ID>/', MsmeDetailView.as_view(), name='msme-detail'), 
]