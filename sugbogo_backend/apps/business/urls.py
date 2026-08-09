from django.urls import path

from .views import BusinessDetailView, BusinessListView

urlpatterns = [
    
    path('', BusinessListView.as_view(), name='business-list'),
    path('<int:BUSINESS_ID>/', BusinessDetailView.as_view(), name='business-detail'), 
]